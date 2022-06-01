import { promises as fs } from "fs";
import { normalizeStatsNzName, TEMP_FILES } from "../util";

export type PopulationsTemplate = {
  [statsNzName: string]: number;
};

export async function parseWikiTemplates(
  wikiTemplates: string[]
): Promise<PopulationsTemplate> {
  const out: PopulationsTemplate = {};

  for (const wikiTemplate of wikiTemplates) {
    const populations = [...wikiTemplate.matchAll(/ \| (.+) = (.+)\n/g)].map(
      (x): [place: string, pop: number] => [
        normalizeStatsNzName(x[1]),
        +x[2].replace(/,/g, ""),
      ]
    );

    Object.assign(out, Object.fromEntries(populations));
  }

  // save the parsed wiki templates for debugging
  await fs.writeFile(
    TEMP_FILES.WIKI_TEMPLATE_PARSED,
    JSON.stringify(out, null, 2)
  );

  return out;
}
