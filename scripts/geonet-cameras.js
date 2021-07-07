/**
 * this will generate a txt file which you can upload
 * using the level0 editor
 */

fetch("http://images.geonet.org.nz/volcano/cameras/all.json")
  .then((r) => r.json())
  .then((d) =>
    d.features.reduce(
      (ac, t) => `${ac}
node: ${t.geometry.coordinates[0]},${t.geometry.coordinates[1]}
  man_made = surveillance
  surveillance:type = camera
  operator = GeoNet
  contact:webcam = http://images.geonet.org.nz/volcano/cameras/${t.properties["latest-image-large"]}
  camera:direction = ${t.properties.azimuth}
  ele = ${t.properties.height}
  name = ${t.properties.title}
  ref = ${t.id}
`,
      ""
    )
  );
