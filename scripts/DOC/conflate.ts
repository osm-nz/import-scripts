import { promises as fs } from "fs";
import { join } from "path";
import assert from "assert";
import { nztmToWgs } from "./nztmToWgs";
import { Campsite, GeoJson, Hut, Lodge, OverpassResponse } from "./types";
import { createDiamond } from "./helpers";

/** map of the OSM tags to add for each DOC facility */
export const FACILITIES_MAP = <const>{
  //
  // huts and campsites
  //
  "Toilets - non-flush": { toilets: "yes", "toilets:disposal": "pitlatrine" },
  "Toilets - flush": { toilets: "yes", "toilets:disposal": "flush" },

  "Water from tap - not treated": { drinking_water: "untreated" },
  "Water from tap - treated": { drinking_water: "yes" },

  "boil before use": {}, // duplicates 'Water from tap - not treated'
  "suitable for drinking": {}, // duplicates 'Water from tap - treated'

  "Water supply": {}, // we ignore this one, since it will always be accompanied by a more specific water attribute.
  "Water from stream": {}, // TODO: maybe add { note: "water available from stream" },

  //
  // huts only
  //
  Heating: { fireplace: "yes" },
  Mattresses: { mattress: "yes" },
  Cooking: { kitchen: "yes" },
  Lighting: { lit: "yes" },

  //
  // campsites only
  //
  Toilets: { toilets: "yes" },

  "Wheelchair accessible": { wheelchair: "yes" },
  "Wheelchair accessible with assistance": { wheelchair: "limited" },

  "Non-powered/tent sites": {}, // default/implied, so no tags to add.
  "Powered sites": { power_supply: "yes" },

  "Cookers/electric stove": { kitchen: "yes" },
  "Dump station": { sanitary_dump_station: "yes" },

  // These only occur once and are mapped as separate OSM features
  "Boat launching": {},
  Jetty: {},
  W: {}, // typo in DOC data
  Shop: {},
  Phone: {},

  BBQ: { bbq: "yes" },
  "Shelter for cooking": { shelter: "yes" },
  "Shower - hot": { shower: "hot" },
  "Shower - cold": { shower: "cold" },
  "Campfires permitted (except in fire bans)": { openfire: "yes" },
};

/** all the tags that we might add */
const TAGS_WE_MANAGE = Object.fromEntries(
  Object.values(FACILITIES_MAP)
    .flatMap(Object.keys)
    .map((key) => [key, true])
);

type Tags = {
  [key: string]: string | number | undefined;
};
type OsmDiffId = `${"n" | "w" | "r"}${number}`;

type DocTagMap = {
  [docId: string]: Tags & { $lng: number; $lat: number };
};
type OsmTagMap = {
  [docId: string]: Tags & { $osmId: OsmDiffId };
};

async function processHuts(): Promise<DocTagMap> {
  const out: DocTagMap = {};

  const huts: GeoJson<Hut> = JSON.parse(
    await fs.readFile(join(__dirname, "../../out/doc_huts.geo.json"), "utf8")
  );

  const linzMap: Record<string, [number, string?]> = JSON.parse(
    await fs.readFile(join(__dirname, "../../out/LINZmap.json"), "utf8")
  );

  for (const hut of huts.features) {
    const H = hut.properties;
    const facilities = H.facilities?.split(",") || [];

    assert(hut.geometry.type === "Point");

    const name = (linzMap[H.assetId]?.[1] ?? H.name).trim();

    out[H.assetId] = {
      $lat: hut.geometry.coordinates[1],
      $lng: hut.geometry.coordinates[0],

      // these tags are on every feature
      operator: "Department of Conservation",
      "operator:wikidata": "Q1191417",
      tourism: "wilderness_hut",

      name,
      "ref:doc": H.assetId,
      "ref:linz:topo50_id": linzMap[H.assetId]?.[0],

      website: H.staticLink.replace(".aspx", "").replace("www.", ""),
      reservation: { Yes: "required", No: "no" }[H.bookable],

      // these might be overriden, if not we add these default values
      mattress: "no",
      fireplace: "no",
      toilets: "no",
      drinking_water: "no",

      // this data is only available from the API, not from GIS:
      // - numberOfBunks
      // - hutCategory
      // - introduction
    };
    for (const $fac of facilities) {
      const fac = $fac.trim();
      if (fac in FACILITIES_MAP) {
        Object.assign(out[H.assetId], FACILITIES_MAP[fac as never]);
      } else {
        console.log("!\t", fac);
      }
    }
  }

  await fs.writeFile(
    join(__dirname, "../../out/DOC_Huts.json"),
    JSON.stringify(out, null, 2)
  );

  return out;
}

async function processCampsites(): Promise<DocTagMap> {
  const out: DocTagMap = {};

  const campsites: GeoJson<Campsite> = JSON.parse(
    await fs.readFile(
      join(__dirname, "../../out/doc_campsites.geo.json"),
      "utf8"
    )
  );

  for (const campsite of campsites.features) {
    const C = campsite.properties;
    const facilities = C.facilities?.split(",") || [];

    assert(campsite.geometry.type === "Point");

    out[C.assetId] = {
      $lat: campsite.geometry.coordinates[1],
      $lng: campsite.geometry.coordinates[0],

      // these tags are on every feature
      operator: "Department of Conservation",
      "operator:wikidata": "Q1191417",
      tourism: "camp_site",

      name: C.name.trim(),
      "ref:doc": C.assetId,

      website: C.staticLink.replace(".aspx", "").replace("www.", ""),
      reservation: { Yes: "required", No: "no" }[C.bookable],
      backcountry: C.campsiteCategory === "Backcountry" ? "yes" : undefined,

      "capacity:tents": `${C.numberOfUnpoweredSites}`,
      "capacity:caravans": `${C.numberOfPoweredSites}`,

      /* eslint-disable no-nested-ternary */
      dog:
        C.dogsAllowed === "No dogs"
          ? "no"
          : C.dogsAllowed === "Dogs on a leash only"
          ? "leashed"
          : C.dogsAllowed ===
            "Dogs allowed. Keep dog under control at all times."
          ? "unleashed"
          : C.dogsAllowed.startsWith("Dogs with a DOC permit only")
          ? "permit"
          : undefined,
      /* eslint-enable no-nested-ternary */

      // these might be overriden, if not we add these default values
      toilets: "no",
    };
    for (const $fac of facilities) {
      const fac = $fac.trim();
      if (fac in FACILITIES_MAP) {
        Object.assign(out[C.assetId], FACILITIES_MAP[fac as never]);
      } else {
        console.log("!\t", fac);
      }
    }
  }

  await fs.writeFile(
    join(__dirname, "../../out/DOC_Campsites.json"),
    JSON.stringify(out, null, 2)
  );

  return out;
}

async function processLodges(): Promise<DocTagMap> {
  const out: DocTagMap = {};

  const lodges: Lodge[] = JSON.parse(
    await fs.readFile(join(__dirname, "../../out/doc_lodges.geo.json"), "utf8")
  );

  for (const L of lodges) {
    const [$lng, $lat] = nztmToWgs(L.$x, L.$y);
    out[L.assetId] = {
      $lat,
      $lng,

      // these tags are on every feature
      operator: "Department of Conservation",
      "operator:wikidata": "Q1191417",
      tourism: "wilderness_hut",

      name: L.name.trim(),
      "ref:doc": L.assetId,
      website: L.webPage.replace(".aspx", "").replace("www.", ""),

      // this data is not available from the API v1, nor from API v2, nor from GIS
      // - bookable
      // - facilities
      // - numberOfBunks
      // - hutCategory
      // - introduction
    };
  }

  await fs.writeFile(
    join(__dirname, "../../out/DOC_Lodges.json"),
    JSON.stringify(out, null, 2)
  );

  return out;
}

async function loadExistingOsmData(): Promise<OsmTagMap> {
  const out: OsmTagMap = {};

  const osmFeatures: OverpassResponse = JSON.parse(
    await fs.readFile(join(__dirname, "../../out/doc_existing.json"), "utf8")
  );
  for (const f of osmFeatures.elements) {
    const docId = f.tags?.["ref:doc"];
    if (docId) {
      // this is a doc feature
      out[docId] = {
        $osmId: `${f.type[0] as "n" | "w" | "r"}${f.id}`,
        ...f.tags,
      };
    }
  }
  return out;
}

/** shallow diff between two key-value pairs */
function objectDiff(current: Tags, expected: Tags): Tags {
  const diff: Tags = {};

  // forwards
  for (const key in expected) {
    if (expected[key] && `${current[key]}` !== `${expected[key]}`) {
      diff[key] = expected[key];
    }
  }

  // backwards
  for (const key in current) {
    if (!expected[key] && TAGS_WE_MANAGE[key]) {
      // if we manage this tag, but it's not in the expected AND it is in osm, then remove it from osm.
      // diff[key] = "🗑️";
    }
  }

  return diff;
}

async function main() {
  const osm = await loadExistingOsmData();

  const doc = {
    ...(await processHuts()),
    ...(await processCampsites()),
    ...(await processLodges()),
  };

  const diff: GeoJson<unknown>["features"] = [];

  let perfect = 0;

  for (const docId in doc) {
    const docFeat = doc[docId];
    const osmFeat = osm[docId];

    const { $lat, $lng, ...docTags } = docFeat;

    if (osmFeat) {
      // already exists in OSM, so lets compare the tags
      const { $osmId, ...osmTags } = osmFeat;
      const tagDiff = objectDiff(osmTags, docTags);
      if (Object.keys(tagDiff).length) {
        // there are some tags that need changing
        diff.push({
          type: "Feature",
          id: $osmId,
          geometry: {
            type: "Polygon",
            coordinates: createDiamond({ lat: $lat, lng: $lng }),
          },
          properties: { __action: "edit", ...tagDiff },
        });
      } else {
        // there are no tags that need changing
        perfect += 1;
      }
    } else {
      // doesn't exist in OSM, so we'll create it
      diff.push({
        type: "Feature",
        id: `NEW${docTags["ref:doc"]}`,
        geometry: {
          type: "Point",
          coordinates: [$lng, $lat],
        },
        properties: docTags,
      });
    }
  }
  const total = Object.keys(doc).length;

  console.log(
    `${perfect}/${total} (${Math.floor((perfect / total) * 100)}%) are perfect!`
  );

  const out: GeoJson<unknown> & { size: string } = {
    type: "FeatureCollection",
    size: "medium",
    features: diff,
  };

  await fs.writeFile(
    join(__dirname, "../../out/DOC.osmPatch.geo.json"),
    JSON.stringify(out, null, 2)
  );
}

main();
