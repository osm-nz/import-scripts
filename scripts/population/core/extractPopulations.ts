import { promises as fs } from "fs";
import { QIdMap, WikipediaPages } from "../api";
import {
  normalizeStatsNzName,
  OverpassResponse,
  TEMP_FILES,
  T_SOURCE_YEAR,
  validateOSMWikiTag,
  WIKI_TEMPLATES,
} from "../util";
import { cleanPopStr, parseWikiPopDate } from "./wikiSyntax";
import { PopulationsTemplate } from "./parseWikiTemplates";

const MAN: Record<string, number> = {
  "March 2018": 2018,
};

export type Populations = {
  [osmId: string]:
    | { type: "no_wikipedia" }
    | { type: "error"; error: string }
    | { type: "no_pop" }
    | { type: "okay"; pop: number; year: number | null; diags: string };
};

// in order of preference
const toRank = { _urban: 3, _metro: 2, undefined: 1, _total: 0 };

function processPlace(
  place: OverpassResponse["elements"][number],
  wikidataLinks: QIdMap,
  wikipediaPages: WikipediaPages,
  populationsTemplate: PopulationsTemplate
): Populations[string] {
  const wikiPageName =
    validateOSMWikiTag(place.tags.wikipedia) ||
    wikidataLinks[place.tags.wikidata];

  if (!wikiPageName) return { type: "no_wikipedia" };

  const wikiPage = wikipediaPages[wikiPageName];

  if (typeof wikiPage === "object") {
    return { type: "error", error: wikiPage.error };
  }

  if (wikiPage.includes("#REDIRECT")) {
    const newPage = wikiPage.match(/#REDIRECT \[\[(.+)\]\]/)?.[1];
    return { type: "error", error: `Wikipedia page redirects to '${newPage}'` };
  }

  const templateUses = WIKI_TEMPLATES.flatMap((template) => [
    ...wikiPage.matchAll(
      new RegExp(
        `population(_total|_urban|_metro)?( +)?=( +)?({{formatnum:)?{{${template}\\|(.+)}}`,
        "g"
      )
    ),
  ]).map((x) => ({
    rank: toRank[x[1] as keyof typeof toRank] ?? -10,
    rawRank: x[1],
    arg1: x[5].split("|")[0], // split the arguments of the template & take the first one
  }));

  // const l = templateUses.sort((a, b) => b.rank - a.rank).map((a) => a.rawRank);
  // if (l.length > 1) {
  //   console.log(`For ${wikiPageName}, using ${l.join(" then ")}`);
  // }

  // if the template is used multiple times on that page, sort the list based on urban/metro/total etc, and
  // use the most appropriate value. If the most appropriate use of the template has no first argument, then
  // the statsNZName is inferred from the wikipedia page name.
  const statsNzPlaceName = templateUses.length
    ? normalizeStatsNzName(
        templateUses.sort((a, b) => b.rank - a.rank)[0].arg1 || wikiPageName
      )
    : null;

  if (statsNzPlaceName) {
    const pop = populationsTemplate[statsNzPlaceName];

    if (!pop) {
      return {
        type: "error",
        error: `Wiki article uses template, but the place name is not in the template ('${statsNzPlaceName}')`,
      };
    }

    return { type: "okay", pop, year: T_SOURCE_YEAR, diags: "T" };
  }

  //
  // If we get to here, the template is not used on this page, so the next thing we check is whether
  // there are any raw population values in the infobox (e.g. "population_urban   =   12,000").
  //

  const rawPopStr = wikiPage
    .match(/population(_total|_urban)?( +)?=( +)?(.+)\n/)?.[4]
    .replace(/,/g, "")
    .trim();

  const rawPopDate = wikiPage
    .match(/(popdate|population_as_of)( +)?=( +)?(.+)\n/)?.[4]
    .replace(/,/g, "")
    .replace(/ census/i, "")
    .trim();

  if (rawPopStr) {
    const cleanedPopStr = cleanPopStr(rawPopStr);

    let year = rawPopDate ? parseWikiPopDate(rawPopDate) : null;

    // if we couldn't parse the date, see if there's an entry in the manual table of date conversions
    if (Number.isNaN(year) && rawPopDate && rawPopDate in MAN) {
      year = MAN[rawPopDate];
    }

    // if the year is still NaN, report it.
    if (Number.isNaN(year)) {
      return {
        type: "error",
        error: `Didn't understand date '${rawPopDate}' (${wikiPageName})`,
      };
    }

    // Check if this is a complex wiki template that adds multiple populations
    if (cleanedPopStr.includes("{{")) {
      const statsNzNames = WIKI_TEMPLATES.flatMap((template) =>
        [
          ...cleanedPopStr.matchAll(
            new RegExp(`{{${template}\\|([^\\|]+)(\\||}})`, "g")
          ),
        ].map((regexRes) => regexRes[1])
      );

      const total = statsNzNames.reduce(
        (ac, t) => ac + populationsTemplate[normalizeStatsNzName(t)],
        0
      );

      if (Number.isNaN(total)) {
        return {
          type: "error",
          error: `raw population is an invalid summation (${cleanedPopStr})`,
        };
      }

      return { type: "okay", pop: total, year, diags: "RS" };
    }

    // this is not a {{Decimals}} template, check if it's invalid for another reason
    if (Number.isNaN(+cleanedPopStr)) {
      return {
        type: "error",
        error: `raw population is not a number (${cleanedPopStr})`,
      };
    }

    return { type: "okay", pop: +cleanedPopStr, year, diags: "R" };
  }

  return { type: "no_pop" };
}

export async function extractPopulations(
  places: OverpassResponse,
  wikidataLinks: QIdMap,
  wikipediaPages: WikipediaPages,
  populationsTemplate: PopulationsTemplate
): Promise<Populations> {
  const out: Populations = {};
  for (const place of places.elements) {
    const osmId = place.type[0] + place.id;

    out[osmId] = processPlace(
      place,
      wikidataLinks,
      wikipediaPages,
      populationsTemplate
    );
  }

  await fs.writeFile(TEMP_FILES.EXTRACT_RESULT, JSON.stringify(out, null, 2));

  const count = Object.values(out).reduce(
    (ac, t) => ({ ...ac, [t.type]: (ac[t.type] ?? 0) + 1 }),
    {} as Record<Populations[string]["type"], number>
  );

  console.log(
    `Extraction stats. OK: ${count.okay}. Error: ${count.error}. No Pop: ${count.no_pop}. No wikipedia: ${count.no_wikipedia}`
  );

  return out;
}
