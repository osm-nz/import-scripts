/**
 * this will generate a txt file which you can upload
 * using the level0 editor
 */

fetch("https://www.journeys.nzta.govt.nz/assets/tas/cameras.json")
  .then((r) => r.json())
  .then((d) =>
    d.features.reduce(
      (ac, t) => `${ac}
node: ${t.geometry.coordinates[1]},${t.geometry.coordinates[0]}
  man_made = surveillance
  surveillance:type = camera
  surveillance:zone = traffic
  source = NZTA
  contact:webcam = https://trafficnz.info/camera/${t.properties.id}.jpg
  camera:direction = ${
    { Northbound: 0, Southbound: 180, Eastbound: 90, Westbound: 270 }[
      t.properties.direction
    ]
  }
  name = ${t.properties.name}
  description = ${t.properties.description}
  ref = ${t.properties.id}
`,
      ""
    )
  );
