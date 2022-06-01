import { promises as fs } from "fs";
import fetch from "node-fetch";
import {
  TEMP_FILES,
  tryRead,
  WikipediaResponse,
  WIKI_TEMPLATES,
} from "../util";

export async function readWikipediaTemplate(): Promise<string[]> {
  const existing = await tryRead<string[] | null>(
    TEMP_FILES.WIKI_TEMPLATE,
    null
  );

  if (existing) {
    console.log("No need to query Wikipedia for Templates.");
    return existing;
  }

  console.log("Fetching Wikipedia Template...");
  const titles = WIKI_TEMPLATES.map((x) => `Template:${x}`).join("|");
  const resp: WikipediaResponse = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${titles}&rvslots=*&rvprop=content&formatversion=2&format=json`
  ).then((r) => r.json());

  const wikiTemplates = resp.query.pages
    .map((page) => page.revisions?.[0].slots.main.content)
    .filter((x): x is string => !!x);

  await fs.writeFile(
    TEMP_FILES.WIKI_TEMPLATE,
    JSON.stringify(wikiTemplates, null, 2)
  );
  return wikiTemplates;
}
