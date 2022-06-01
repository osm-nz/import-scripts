import fetch from "node-fetch";
import { promises as fs } from "fs";
import {
  chunk,
  OverpassResponse,
  TEMP_FILES,
  timeout,
  tryRead,
  validateOSMWikiTag,
  WikipediaResponse,
} from "../util";
import { QIdMap } from "./queryWikidata";

const WIKIPEDIA_PER_PAGE = 50;

export type WikipediaPages = { [pageName: string]: string | { error: string } };

export async function fetchWikipediaPages(
  places: OverpassResponse,
  wikidataLinks: QIdMap
): Promise<WikipediaPages> {
  // if the OSM feature doesn't have a wikipedia tag, we need to query wikidata

  const db = await tryRead<WikipediaPages>(TEMP_FILES.WIKI_PAGES, {});

  const wikipediaLookups = places.elements
    .map(
      (f) =>
        validateOSMWikiTag(f.tags.wikipedia) || wikidataLinks[f.tags.wikidata]
    )
    .filter((wikiPageName) => wikiPageName && !(wikiPageName in db)); // remove any that are already in our db

  const wikipediaLookupChunks = chunk(wikipediaLookups, WIKIPEDIA_PER_PAGE);
  const anyRedirectsNeedFixing = Object.values(db).some((v) =>
    v.toString().includes("#REDIRECT")
  );

  if (!wikipediaLookupChunks.length && !anyRedirectsNeedFixing) {
    console.log("No need to query Wikipedia for pages.");
    return db;
  }

  console.log(`Need to query wikipedia for ${wikipediaLookups.length} places.`);

  for (const [i, pageNamesChunk] of wikipediaLookupChunks.entries()) {
    const [from, to] = [
      WIKIPEDIA_PER_PAGE * i,
      WIKIPEDIA_PER_PAGE * (i + 1) - 1,
    ];
    console.log(`\t Fetching items ${from}-${to}...`);

    // docs: https://en.wikipedia.org/w/api.php?action=help&modules=query

    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(
      pageNamesChunk.join("|")
    )}&rvslots=*&rvprop=content&formatversion=2&format=json`;
    const res: WikipediaResponse = await fetch(url).then((r) => r.json());

    for (const page of res.query.pages) {
      const pageContents = page.revisions?.[0]?.slots.main.content;
      db[page.title] = pageContents || { error: "No page content" };
    }

    // save the updated file
    await fs.writeFile(TEMP_FILES.WIKI_PAGES, JSON.stringify(db, null, 2));

    await timeout(500); // wait 0.5 seconds in between requests
  }

  // pages that are rediects and need to be followed to fetch the real page content

  const redirectsToFollow: Record<string, string> = {}; // reverse map (newName -> oldName)

  for (const page in db) {
    const content = db[page];
    if (typeof content === "string" && content.includes("#REDIRECT")) {
      const newPage = content.match(/#REDIRECT \[\[(.+)\]\]/)?.[1];
      if (newPage) {
        redirectsToFollow[newPage] = page;
      } else {
        db[page] = { error: "Couldn't parse redirect" };
      }
    }
  }

  const sourcePages = Object.values(redirectsToFollow);
  const targetPages = Object.keys(redirectsToFollow);
  if (sourcePages.length) {
    console.log(`\t Fetching ${sourcePages.length} redirect pages...`);
    // assume that there are never more than 50 redirects to follow to keep this code simple
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(
      targetPages.join("|")
    )}&rvslots=*&rvprop=content&formatversion=2&format=json`;

    const res: WikipediaResponse = await fetch(url).then((r) => r.json());
    for (const page of res.query.pages) {
      const oldPageName = redirectsToFollow[page.title];
      const pageContents = page.revisions?.[0]?.slots.main.content;
      console.log([oldPageName, page.title]);
      db[oldPageName] = pageContents
        ? `<!-- Redirected 🫠${oldPageName}🫠${page.title}🫠 --> ${pageContents}`
        : { error: "No page content after redirect" };
    }

    // save the updated file
    await fs.writeFile(TEMP_FILES.WIKI_PAGES, JSON.stringify(db, null, 2));
  }

  return db;
}
