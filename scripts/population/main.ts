// run with `yarn ts-node scripts/population`
import { promises as fs } from "fs";
import {
  fetchOSMPlaces,
  fetchWikipediaPages,
  queryWikidata,
  readWikipediaTemplate,
} from "./api";
import { parseWikiTemplates, extractPopulations, conflate } from "./core";
import { TEMP_FILES } from "./util";

async function main() {
  // fetch all the data we need
  const places = await fetchOSMPlaces();
  const wikiTemplates = await readWikipediaTemplate();
  const wikidataLinks = await queryWikidata(places);
  const wikipediaPages = await fetchWikipediaPages(places, wikidataLinks);

  // parse the unstructured data from wikipedia
  const populationsDB = await parseWikiTemplates(wikiTemplates);
  const finalPopulations = await extractPopulations(
    places,
    wikidataLinks,
    wikipediaPages,
    populationsDB
  );
  const { report, osmPatchFile } = await conflate(
    places,
    finalPopulations,
    wikidataLinks,
    wikipediaPages
  );

  // save the final output
  await fs.writeFile(TEMP_FILES.REPORT, report);
  await fs.writeFile(
    TEMP_FILES.OSM_PATCH,
    JSON.stringify(osmPatchFile, null, 2)
  );
}

main();
