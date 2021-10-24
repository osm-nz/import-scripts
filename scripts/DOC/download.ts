import { promises as fs } from "fs";
import fetch from "node-fetch";
import { join } from "path";
import { Lodge, LodgeMeta } from "./types";

async function main() {
  await fs.mkdir(join(__dirname, "../../out/"), { recursive: true });

  // 1. existing OSM data, easy to fetch since every feature has ref:doc
  const query = `
    [out:json][timeout:25];
    (nwr["ref:doc"];);
    out body;>;out skel qt;
  `;

  console.log("fetching existing OSM data...");
  const existingOsmData = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  ).then((r) => r.json());
  await fs.writeFile(
    join(__dirname, "../../out/doc_existing.json"),
    JSON.stringify(existingOsmData, null, 2)
  );

  // 2. huts are easy, thanks arcgis
  console.log("fetching huts...");
  const huts = await fetch(
    "https://opendata.arcgis.com/api/v3/datasets/7f7321caf77b4101b9573db4575dd794_0/downloads/data?format=geojson&spatialRefId=4326"
  ).then((r) => r.json());
  await fs.writeFile(
    join(__dirname, "../../out/doc_huts.geo.json"),
    JSON.stringify(huts, null, 2)
  );

  // 3. campsites are easy, thanks arcgis
  console.log("fetching campsites...");
  const campsites = await fetch(
    "https://opendata.arcgis.com/api/v3/datasets/c417dcd7c9fb47b489df1f9f0a673190_0/downloads/data?format=geojson&spatialRefId=4326"
  ).then((r) => r.json());
  await fs.writeFile(
    join(__dirname, "../../out/doc_campsites.geo.json"),
    JSON.stringify(campsites, null, 2)
  );

  const { API_V1_KEY } = process.env;
  if (!API_V1_KEY) {
    console.error("No API_V1_KEY environment variable");
    process.exit(1);
  }

  // 4. lodges are not available from GIS nor from the v2 API.
  console.log("fetching lodges...");
  const lodgeList: LodgeMeta = await fetch(
    "https://api.doc.govt.nz/v1/dto/lodges",
    { headers: { "x-api-key": API_V1_KEY } }
  ).then((r) => r.json());

  const lodgeOut: Lodge[] = [];
  try {
    for (const [i, lodgeMeta] of lodgeList.features.entries()) {
      const assetId = lodgeMeta.attributes.EQUIPMENT;
      console.log(
        `\tfetching lodge ${i}/${lodgeList.features.length} (${assetId})...`
      );

      const lodge: Lodge = await fetch(
        `https://api.doc.govt.nz/v1/dto/lodges/${assetId}/detail`,
        { headers: { "x-api-key": API_V1_KEY } }
      ).then((r) => r.json());

      lodgeOut.push({
        ...lodge,
        $x: lodgeMeta.geometry.x,
        $y: lodgeMeta.geometry.y,
      });
    }
    console.log("All good");
  } catch (ex) {
    console.error(ex);
  } finally {
    // save what we have, if one of the API requests fails
    await fs.writeFile(
      join(__dirname, "../../out/doc_lodges.geo.json"),
      JSON.stringify(lodgeOut, null, 2)
    );
  }
}

main();
