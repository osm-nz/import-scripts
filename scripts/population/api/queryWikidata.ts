import fetch from "node-fetch";
import { promises as fs } from "fs";
import {
  chunk,
  OverpassResponse,
  TEMP_FILES,
  timeout,
  tryRead,
  validateOSMWikiTag,
  WikidataResponse,
} from "../util";

const WIKIDATA_PER_PAGE = 50;

export type QIdMap = { [qId: string]: string | null };

/** if the OSM feature doesn't have a wikipedia tag, we need to query wikidata */
export async function queryWikidata(places: OverpassResponse): Promise<QIdMap> {
  // in this file, if the value is null it means we have already queried wikidata, but there is no wikipedia article
  const qIdMap = await tryRead<QIdMap>(TEMP_FILES.WIKIDATA_LINK, {});

  const wikidataLookups = places.elements
    .filter((f) => !validateOSMWikiTag(f.tags.wikipedia))
    .map((f) => f.tags.wikidata)
    .filter((qId) => !(qId in qIdMap)); // remove any that are already in our db

  const wikidataLookupChunks = chunk(wikidataLookups, WIKIDATA_PER_PAGE);

  if (!wikidataLookupChunks.length) {
    console.log("No need to query wikidata.");
    return qIdMap;
  }

  console.log(`Need to query wikidata for ${wikidataLookups.length} places.`);

  for (const [i, qIdChunk] of wikidataLookupChunks.entries()) {
    const [from, to] = [WIKIDATA_PER_PAGE * i, WIKIDATA_PER_PAGE * (i + 1) - 1];
    console.log(`\t Fetching items ${from}-${to}...`);

    // docs: https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities

    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qIdChunk.join(
      "|"
    )}&props=sitelinks&format=json`;
    const res: WikidataResponse = await fetch(url).then((r) => r.json());

    for (const qId in res.entities) {
      const enWiki = res.entities[qId].sitelinks?.enwiki?.title;
      qIdMap[qId] = enWiki || null;
    }

    // save the updated file
    await fs.writeFile(
      TEMP_FILES.WIKIDATA_LINK,
      JSON.stringify(qIdMap, null, 2)
    );

    await timeout(500); // wait 0.5 seconds in between requests
  }

  return qIdMap;
}
