// run with `yarn ts-node scripts/population`
// updates the poplulation= tag on places in OSM that have a wikipedia tag.

import { join } from "path";
import { promises as fs } from "fs";
import fetch from "node-fetch";

const WIKI_TEMPLATES = [
  "NZ population data 2018",
  "NZ population data 2018 SA2",
];
// the year that the templates were updated. If we get the population
// directly from the page, then we use the year on the page (popdate= or population_as_of=)
const T_SOURCE_YEAR = 2021;

const TEMP_FILES = {
  WIKI_TEMPLATE: join(__dirname, "../out/pop-wiki-template.json"),
  PROGRESS: join(__dirname, "../out/pop-wiki-progress.json"),
  OSM_QUERY: join(__dirname, "../out/pop-osm-query.json"),
  REPORT: join(__dirname, "../out/pop-diff.txt"),
  OSM_CHANGE: join(__dirname, "../out/pop-diff.osc"),
};

type OverpassResponse = {
  version: 0.6;
  generator: string;
  osm3s: {
    timestamp_osm_base: string; // eslint-disable-line camelcase
    copyright: string;
  };
  remark?: string;
  elements: {
    timestamp?: string;
    version?: number;
    changeset?: number;
    user?: string;
    uid?: number;
    type: "node";
    id: number;
    lat: number;
    lon: number;
    tags: Record<string, string>;
  }[];
};

type WikiResponse = {
  query: {
    pages: {
      title: string;
      revisions?: [{ slots: { main: { content: string } } }];
    }[];
  };
};

async function readWikipediaTemplate(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readFile(TEMP_FILES.WIKI_TEMPLATE, "utf8"));
  } catch {
    const res = {};

    console.log("[API] Wiki Template");
    const titles = WIKI_TEMPLATES.map((x) => `Template:${x}`).join("|");
    const resp: WikiResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${titles}&rvslots=*&rvprop=content&formatversion=2&format=json`
    ).then((r) => r.json());

    for (const page of resp.query.pages) {
      const wikiTemplate = page.revisions![0].slots.main.content;

      const populations: [place: string, pop: number][] = [
        ...wikiTemplate.matchAll(/ \| (.+) = (.+)\n/g),
      ].map((x) => [x[1], +x[2].replace(/,/g, "")]);

      Object.assign(res, Object.fromEntries(populations));
    }

    await fs.writeFile(TEMP_FILES.WIKI_TEMPLATE, JSON.stringify(res, null, 2));
    return res;
  }
}

type Status =
  | { type: "redirect"; from: string; to?: string }
  | { type: "page_not_found"; from: string }
  | { type: "okay_t"; from: string; statsId?: string }
  | { type: "okay_raw"; from: string; pop: number; date?: string }
  | { type: "wiki_has_no_pop"; from: string }
  | { type: "unknown"; from: string };

const getPage = (x: Status): string | undefined =>
  x.type === "redirect" ? x.to : x.from;

async function readWikipediaPages(
  chunk: [osmId: string, status: Status][]
): Promise<[osmId: string, newStatus: Status][]> {
  console.log(`[API] Wiki: ${chunk.length} places`);
  const resp: WikiResponse = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(
      chunk.map((x) => getPage(x[1])).join("|")
    )}&rvslots=*&rvprop=content&formatversion=2&format=json`
  ).then((r) => r.json());

  const out: [osmId: string, newStatus: Status][] = [];
  for (const page of resp.query.pages) {
    const placeName = page.title;
    const osmId = chunk.find(
      (x) => getPage(x[1])?.replace(/ /g, "") === placeName.replace(/ /g, "")
    )?.[0];
    if (!osmId || !page.revisions) {
      out.push([
        osmId || `UNKNOWN(${placeName})`,
        { type: "page_not_found", from: placeName },
      ]);
      continue; // eslint-disable-line no-continue
    }
    const wikiPage = page.revisions[0].slots.main.content;

    if (wikiPage.includes("#REDIRECT")) {
      const newPage = wikiPage.match(/#REDIRECT \[\[(.+)\]\]/)?.[1];
      out.push([osmId, { type: "redirect", from: placeName, to: newPage }]);
    } else {
      const templateUses = WIKI_TEMPLATES.flatMap((template) => [
        ...wikiPage.matchAll(
          new RegExp(
            `population(_total|_urban)?( +)?=( +)?({{formatnum:)?{{${template}\\|(.+)}}`,
            "g"
          )
        ),
      ]).map((x) => x[5].split("|")[0]); // split the arguments of the template take the first one

      // if the template is used, find the first template where the first argument isn't empty
      // if the first arg is empty, then it's infered from the wikipedia page name
      const templateName = templateUses.length
        ? templateUses.find((x) => x) || page.title
        : null;

      const rawPopStr = wikiPage
        .match(/population(_total|_urban)?( +)?=( +)?(.+)\n/)?.[4]
        .replace(/,/g, "");
      const rawPopDate = wikiPage
        .match(/(popdate|population_as_of)( +)?=( +)?(.+)\n/)?.[4]
        .replace(/,/g, "")
        .replace(/ census/i, "")
        .trim();

      if (templateName) {
        out.push([
          osmId,
          { type: "okay_t", from: placeName, statsId: templateName },
        ]);
      } else if (rawPopStr) {
        out.push([
          osmId,
          {
            type: "okay_raw",
            from: placeName,
            pop: +rawPopStr,
            date: rawPopDate,
          },
        ]);
      } else {
        out.push([osmId, { type: "wiki_has_no_pop", from: placeName }]);
      }
    }
  }
  return out;
}

async function extractFromOSM(): Promise<OverpassResponse> {
  try {
    return JSON.parse(await fs.readFile(TEMP_FILES.OSM_QUERY, "utf8"));
  } catch {
    console.log("[API] OSM");

    const bbox = "-47.960502,164.081757,-32.805745,179.635359"; // this is just the mainland
    const query = `
      [out:json][timeout:60];
      (
        node["place"]["wikipedia"](${bbox});
      );
      out body;
      out meta;
      >;
      out skel qt;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
      query
    )}`;
    const resp: OverpassResponse = await fetch(url).then((r) => r.json());

    await fs.writeFile(TEMP_FILES.OSM_QUERY, JSON.stringify(resp, null, 2));
    return resp;
  }
}

async function main() {
  const places = await extractFromOSM();
  const wikiTemplate = await readWikipediaTemplate();

  let progress: Record<string, Status>;
  try {
    progress = JSON.parse(await fs.readFile(TEMP_FILES.PROGRESS, "utf8"));
  } catch {
    progress = Object.fromEntries(
      places.elements
        .filter(
          (x) =>
            x.tags.wikipedia.split(":")[0] === "en" && // the te reo wikipedia doesn't have populations
            !x.tags.wikipedia.includes("#") // and references to parts of pages will never work
        )
        .map((x) => [
          x.id,
          { type: "unknown", from: x.tags.wikipedia.split(":")[1] },
        ])
    );
    await fs.writeFile(TEMP_FILES.PROGRESS, JSON.stringify(progress, null, 2));
  }

  const needsAction = Object.entries(progress).filter(
    (x) => x[1].type === "redirect" || x[1].type === "unknown"
  );

  console.log(`${needsAction.length} places need actioning`);

  // request 50 pages at a time
  for (let i = 0; i < needsAction.length; i += 50) {
    console.log(`${i} to ${i + 50}...`);
    const chunk = needsAction.slice(i, i + 50);
    const chunkMappedNames = await readWikipediaPages(chunk);
    for (const [id, newStatus] of chunkMappedNames) {
      progress[id] = newStatus;
    }

    // save it as we go
    await fs.writeFile(TEMP_FILES.PROGRESS, JSON.stringify(progress, null, 2));
  }

  console.log("Done");

  if (Object.values(progress).some((x) => x.type === "redirect")) {
    console.warn("(!) You need to run the script again");
  }

  const diff = places.elements
    .filter((node) => node.version) // strip out items without metadata
    .map((node) => {
      const currentPop = +node.tags.population;
      const p = progress[node.id];
      const maybeRawPop = p?.type === "okay_raw" ? p.pop : null;
      const maybeStatsId = p?.type === "okay_t" ? p.statsId : null;
      const date = p?.type === "okay_raw" ? p.date : T_SOURCE_YEAR;
      const newPop = maybeStatsId ? wikiTemplate[maybeStatsId] : maybeRawPop;

      // if newPop is zero, we ignore it. Chances are higher it's a data error
      // than an actual suburb with 0 population.
      if (!newPop || newPop === currentPop) return undefined;

      const THRES = 1.25; // if it changes by more than 1.25 times, flag it
      const flag =
        Math.max(currentPop, newPop) / Math.min(currentPop, newPop) > THRES;

      if (date && Number.isNaN(+date)) {
        console.warn(
          "(!) STOP. You need to repair some dates in the progress file",
          [date]
        );
      }

      return {
        currentPop,
        newPop,
        flag,
        node,
        newTags: {
          ...node.tags,
          population: newPop,
          "source:population": `Statistics NZ ${
            date || ""
          } via Wikipedia`.replace("  ", " "),
          "population:date": null, // rarely used, so delete it now that it's out of date
        },
      };
    })
    .filter(<T>(x: T | undefined): x is T => !!x);

  const report = diff
    .map(
      (x) =>
        `${x.node.id}\t\t${x.flag ? "🚩" : ""}${x.node.tags.name}\t\told: ${
          x.currentPop
        }\t\tnew: ${x.newPop}`
    )
    .join("\n");

  const osmChange = `
    <osmChange version="0.6" generator="Population Updater">
      <create />
      <modify>
${diff
  .map((x) => {
    return `        <node id="${x.node.id}" lon="${x.node.lon}" lat="${
      x.node.lat
    }" version="${x.node.version}">
${Object.entries(x.newTags)
  .filter(([k, v]) => k && v)
  .map(([k, v]) => `          <tag k="${k}" v="${v}" />`)
  .join("\n")}
        </node>`;
  })
  .join("\n")}
      </modify>
      <delete if-unused="true" />
    </osmChange>`;

  await fs.writeFile(TEMP_FILES.REPORT, report);
  await fs.writeFile(TEMP_FILES.OSM_CHANGE, osmChange);
}

main();
