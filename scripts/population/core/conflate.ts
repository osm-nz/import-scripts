import { createDiamond } from "../../DOC/helpers";
import { GeoJson } from "../../DOC/types";
import { QIdMap, WikipediaPages } from "../api";
import { OverpassResponse, POP_SOURCE, validateOSMWikiTag } from "../util";
import { entryToTagDiff } from "./entryToTagDiff";
import { Populations } from "./extractPopulations";
import { generateReport } from "./Report";

type Tags = {
  name?: string;
  wp?: string;
  pop?: string;
  popSrc?: string;
  popDate?: string;
};
export type Entry = {
  osm: [string, number];
  q: string;
  lat: number;
  lng: number;
  base: Tags;
  changes?: Tags;
  error?: string;
};
export type JsonReport = {
  error: Entry[];
  boring: Entry[];
  interesting: Entry[];
};

// sort the report by how interesting the feature is
const sorter = (e: Entry) =>
  Object.keys(e.base).length + Object.keys(e.changes || {}).length;

export async function conflate(
  places: OverpassResponse,
  finalPopulations: Populations,
  wikidataLinks: QIdMap,
  wikipediaPages: WikipediaPages
): Promise<{ report: string; osmPatchFile: unknown }> {
  const osmObj = Object.fromEntries(
    places.elements.map((p) => [p.type[0] + p.id, p])
  );

  const interesting: Entry[] = [];
  const boring: Entry[] = [];
  const error: Entry[] = [];

  for (const osmId in finalPopulations) {
    const v = finalPopulations[osmId];
    const place = osmObj[osmId];

    const wikiPageName =
      validateOSMWikiTag(place.tags.wikipedia) ||
      wikidataLinks[place.tags.wikidata];

    const base: Tags = {
      name: place.tags.name,
      wp: place.tags.wikipedia,
      pop: place.tags.population,
      popSrc: place.tags["source:population"],
      popDate: place.tags["population:date"],
    };

    if (v.type === "no_pop" || v.type === "no_wikipedia") {
      boring.push({
        osm: [place.type, place.id],
        q: place.tags.wikidata,
        lat: place.lat,
        lng: place.lon,
        base,
      });
    } else if (v.type === "error") {
      // error
      error.push({
        osm: [place.type, place.id],
        q: place.tags.wikidata,
        lat: place.lat,
        lng: place.lon,
        base,
        error: v.error,
      });
    } else {
      // interesting feature

      if (!wikiPageName) throw new Error(); // will never happen, purely to keep TS happy

      const newWikiPage =
        // (a) if the current value in OSM was redirected
        wikipediaPages[wikiPageName].toString().split("🫠")[2] ||
        // (b) if the OSM feature is missing the wikipedia tag
        (!validateOSMWikiTag(place.tags.wikipedia) && wikiPageName);

      const changes: Tags = {};
      if (newWikiPage) changes.wp = `en:${newWikiPage}`;
      if (base.pop !== `${v.pop}`) changes.pop = `${v.pop}`;
      if (base.popSrc !== POP_SOURCE) changes.popSrc = POP_SOURCE;
      if (base.popDate !== `${v.year}` && v.year) changes.popDate = `${v.year}`;

      if (changes.pop === "0" && !base.pop) {
        console.log("Setting population=0 - please verify", base.name);
      }

      interesting.push({
        osm: [place.type, place.id],
        q: place.tags.wikidata,
        lat: place.lat,
        lng: place.lon,
        base,
        changes,
      });
    }
  }

  interesting.sort((a, b) => sorter(b) - sorter(a));

  const json = { error, interesting, boring };
  const report = generateReport(json);

  const osmPatchFile: GeoJson<unknown> & { size: string } = {
    type: "FeatureCollection",
    size: "large",
    features: interesting
      .map(
        (place) =>
          <const>{
            type: "Feature",
            id: place.osm[0][0] + place.osm[1],
            __name: place.changes?.name || place.base.name,
            geometry: {
              type: "Polygon",
              coordinates: createDiamond(place),
            },
            properties: { __action: "edit", ...entryToTagDiff(place) },
          }
      )
      .filter((x) => Object.keys(x.properties).length > 1),
  };

  return { report, osmPatchFile };
}
