import { promises as fs } from "fs";
import fetch from "node-fetch";
import { OverpassResponse, TEMP_FILES, tryRead } from "../util";

export async function fetchOSMPlaces(): Promise<OverpassResponse> {
  const existing = await tryRead<OverpassResponse | null>(
    TEMP_FILES.OSM_QUERY,
    null
  );

  if (existing) {
    console.log("No need to query OSM.");
    return existing;
  }

  console.log("Fetching data from OSM...");

  const bbox = "-47.960502,164.081757,-32.805745,179.635359"; // this is just the mainland
  const query = `
    [out:json][timeout:60];
    (
      node[place][wikidata](${bbox});
    );
    out meta;
  `;

  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
    query
  )}`;
  const resp: OverpassResponse = await fetch(url).then((r) => r.json());

  await fs.writeFile(TEMP_FILES.OSM_QUERY, JSON.stringify(resp, null, 2));
  return resp;
}
