import { join } from "path";

export const WIKI_TEMPLATES = [
  "NZ population data 2018",
  "NZ population data 2018 SA2",
];

// the year that the templates were updated. If we get the population
// directly from the page, then we use the year on the page (popdate= or population_as_of=)
export const T_SOURCE_YEAR = 2021;

// this goes in OSM's "source:population" tag
export const POP_SOURCE = "Statistics NZ via Wikipedia";

export const TEMP_FILES = {
  OSM_QUERY: join(__dirname, "../../../out/pop-osm-query.json"),
  WIKI_TEMPLATE: join(__dirname, "../../../out/pop-wiki-template.json"),
  WIKI_TEMPLATE_PARSED: join(
    __dirname,
    "../../../out/pop-wiki-template-parsed.json"
  ),
  WIKIDATA_LINK: join(__dirname, "../../../out/pop-wikidata.json"),
  WIKI_PAGES: join(__dirname, "../../../out/pop-wiki-pages.json"),
  EXTRACT_RESULT: join(__dirname, "../../../out/pop-result.json"),

  // final outputs
  REPORT: join(__dirname, "../../../out/pop-OUTPUT.html"),
  OSM_PATCH: join(__dirname, "../../../out/pop-OUTPUT.osmPatch.geojson"),
};
