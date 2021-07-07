/**
 * this will generate several txt files which you can upload
 * using the level0 editor
 */

// from https://api.geonet.org.nz/network/sensor/type
const types = {
  Accelerometer: {
    // 1. assuming its for seismic since it's grouped with type 10
    "monitoring:seismic_activity": "yes",
  },
  Barometer: {
    // 2. Atmospheric pressure
    "monitoring:pressure": "yes",
  },
  "Broadband Seismometer": {
    // 3. Broadband sensors are three-component seismometers capable of sensing ground motions over a wide range of frequencies.
    "monitoring:seismic_activity": "yes",
  },
  "GNSS Antenna": {
    // 4. GPS Satelite
    "monitoring:gps": "yes",
  },
  Hydrophone: {
    // 5. A microphone which detects sound waves under water.
    "monitoring:noise": "yes",
  },
  Microphone: {
    // 6. "Air pressure sensor" - an unintuitive name, grouped with #2
    "monitoring:pressure": "yes",
  },
  "Pressure Sensor": {
    // 7. "Coastal sea level gauge"
    "monitoring:tide_gauge": "yes",
  },
  "Short Period Borehole Seismometer": {
    // 8. Borehole seismometers are downhole seismometers that are designed for deployment in steel-cased deep boreholes.
    "monitoring:seismic_activity": "yes",
  },
  "Short Period Seismometer": {
    // 9. Short Period Seismometers are designed for monitoring earthquakes in your local region, typically within about 500km of the sensor. Earthquake detection requires High Sensitivity geophones, but when you are close to an earthquake you also need a sensor that can see high-frequency signals.
    "monitoring:seismic_activity": "yes",
  },
  "Strong Motion Sensor": {
    // 10. Strong-motion accelerometers are located in major centres of population, near significant faults, or in different types of building structures. They are capable of measuring very strong shaking associated with damaging earthquakes.
    "monitoring:seismic_activity": "yes",
  },
};

/* group - from https://www.geonet.org.nz/assets/js/c9e5945d-geonet-map-network.js
  {type: "2,6", name: "Air pressure sensor", index: 2},
  {type: "7", name: "Coastal sea level gauge", index: 7},
  {type: "3", name: "Broadband seismometer", index: 3},
  {type: "4", name: "GNSS/GPS", index: 4},
  {type: "8,9", name: "Short period seismometer", index: 8},
  {type: "1,10", name: "Strong motion sensor", index: 1}
*/

const { readFileSync, writeFileSync } = require("fs");
const fetch = require("node-fetch");

const file = JSON.parse(readFileSync("./gns.json")); // from https://api.geonet.org.nz/network/sensor?sensorType=1,2,3,4,5,6,7,8,9,10&endDate=9999-01-01

async function main() {
  const out = {};

  for (const f of file.features) {
    // if destroyed/removed, don't add it
    if (new Date(f.properties.End) < new Date()) continue; // eslint-disable-line no-continue

    const island = f.geometry.coordinates[1] < -41.8859 ? "south" : "north";
    const id = f.properties.Code;

    if (!out[island]) out[island] = {};

    const obj = {
      $lat: f.geometry.coordinates[1],
      $lng: f.geometry.coordinates[0],
      man_made: "monitoring_station",
      ref: f.properties.Code,
      operator: "GeoNet",
      description: f.properties.SensorType,
      website: `https://geonet.org.nz/data/network/${
        f.properties.Station ? "sensor" : "mark"
      }/${f.properties.Code}`,
      // we use the start date form the other API since it's more accurate
      ...types[f.properties.SensorType],
    };

    if (!out[island][id]) out[island][id] = obj;
    else {
      // it already exists. i.e. it's a station that measures two things.
      Object.assign(out[island][id], obj, {
        // these tags are more complicated to merge
        description: `${out[island][id].description} + ${obj.description}`,
      });
    }

    if (f.properties.Station && !out[island][id].name) {
      // fetch the name from a seperate API
      const details = await fetch(
        `https://api.geonet.org.nz/network/fdsn/station?network=NZ&station=${f.properties.Code}`
      ).then((r) => r.json());
      const startDate = details.Start.split("T")[0];

      out[island][id].name = details.Name;
      out[island][id].start_date = startDate;
    }
  }

  for (const x in out) {
    const level0 = Object.values(out[x]).reduce(
      (ac, { $lat, $lng, ...tags }) => `${ac}
node: ${$lat},${$lng}
  ${Object.entries(tags)
    .map((kv) => kv.join(" = "))
    .join("\n  ")}
`,
      ""
    );
    writeFileSync(`./${x}.txt`, level0);
  }

  console.log(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length]));
}

main();
