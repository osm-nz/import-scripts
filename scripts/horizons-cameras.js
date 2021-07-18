/**
 * this will generate a txt file which you can upload
 * using the level0 editor
 */

fetch("https://envirodata.horizons.govt.nz/api/sites")
  .then((r) => r.json())
  .then((d) =>
    d
      .filter((x) => x.webcamImageUrl)
      .reduce(
        (ac, t) => `${ac}
node: ${t.latitude},${t.longitude}
  man_made = surveillance
  surveillance:type = camera
  source = Horizons Regional Council
  contact:webcam = ${t.webcamImageUrl}
  name = ${t.displayName}
  ref = ${t.id}
`,
        ""
      )
  );
