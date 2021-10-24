const { sin, cos, tan, sqrt, PI: π } = Math;

// formulae: https://linz.govt.nz/data/geodetic-services/coordinate-conversion/projection-conversions/transverse-mercator-transformation-formulae

/** Semi-major axis of reference ellipsoid - from https://developers.arcgis.com/javascript/3/jshelp/gcs.html for NZGD_2000 */
const a = 6_378_137;
/** Ellipsoidal flattening - from https://developers.arcgis.com/javascript/3/jshelp/gcs.html for NZGD_2000 */
const f = 1 / 298.257222101;
/** Origin latitude */
const Φ0 = 0;
/** Origin longitude */
const λ0 = 173;
/** False Easting/Northing */
const [E0, N0] = [1600000, 10000000];
/** Central meridian scale factor - from https://linz.govt.nz/kb/915#cmsf */
const k0 = 0.9996;

// compute constants

const b = a * (1 - f);
const eˢ = 2 * f - f ** 2; // e²

const A0 = 1 - eˢ / 4 - (3 * eˢ ** 2) / 64 - (5 * eˢ ** 3) / 256;
const A2 = (3 / 8) * (eˢ + eˢ ** 2 / 4 + (15 * eˢ ** 3) / 128);
const A4 = (15 / 256) * (eˢ ** 2 + (3 * eˢ ** 3) / 4);
const A6 = (35 * eˢ ** 3) / 3072;

/** meridian arc */
const m0 =
  a * (A0 * Φ0 - A2 * sin(2 * Φ0) + A4 * sin(4 * Φ0) + A6 * sin(6 * Φ0));

/**
 * @param E Easting (X)
 * @param N Northing (Y)
 */
export function nztmToWgs(E: number, N: number): [lng: number, lat: number] {
  const Nʼ = N - N0;
  const mʼ = m0 + Nʼ / k0;
  const n = (a - b) / (a + b);
  const G =
    (a *
      (1 - n) *
      (1 - n ** 2) *
      (1 + (9 * n ** 2) / 4 + (225 * n ** 4) / 64) *
      π) /
    180.0;
  const Σ = (mʼ * π) / (180 * G);
  const Φʼ =
    Σ +
    ((3 * n) / 2 - (27 * n ** 3) / 32) * sin(2 * Σ) +
    ((21 * n ** 2) / 16 - (55 * n ** 4) / 32) * sin(4 * Σ) +
    ((151 * n ** 3) / 96) * sin(6 * Σ) +
    ((1097 * n ** 4) / 512) * sin(8 * Σ);

  const ρʼ = (a * (1 - eˢ)) / ((1 - eˢ * sin(Φʼ)) ** 2) ** 1.5;
  const υʼ = a / sqrt(1 - eˢ * sin(Φʼ) ** 2);
  const Ψʼ = υʼ / ρʼ;
  const tʼ = tan(Φʼ);
  const Eʼ = E - E0;
  const χ = Eʼ / (k0 * υʼ);

  // φ
  const latT1 = (tʼ * Eʼ * χ) / (k0 * ρʼ * 2);
  const latT2 =
    ((latT1 * χ ** 2) / 12) *
    (-4 * Ψʼ ** 2 + 9 * Ψʼ * (1 - tʼ ** 2) + 12 * tʼ ** 2);
  const latT3 =
    ((tʼ * Eʼ * χ ** 5) / (k0 * ρʼ * 720)) *
    (8 * Ψʼ ** 4 * (11 - 24 * tʼ ** 2) -
      12 * Ψʼ ** 3 * (21 - 71 * tʼ ** 2) +
      15 * Ψʼ ** 2 * (15 - 98 * tʼ ** 2 + 15 * tʼ ** 4) +
      180 * Ψʼ * (5 * tʼ ** 2 - 3 * tʼ ** 4) +
      360 * tʼ ** 4);
  const latT4 =
    ((tʼ * Eʼ * χ ** 7) / (k0 * ρʼ * 40320)) *
    (1385 + 3633 * tʼ ** 2 + 4095 * tʼ ** 4 + 1575 * tʼ ** 6);

  // λ
  const lngT1 = χ * (1 / cos(Φʼ));
  const lngT2 = ((χ ** 3 * (1 / cos(Φʼ))) / 6) * (Ψʼ + 2 * tʼ ** 2);
  const lngT3 =
    ((χ ** 5 * (1 / cos(Φʼ))) / 120) *
    (-4 * Ψʼ ** 3 * (1 - 6 * tʼ ** 2) +
      Ψʼ ** 2 * (9 - 68 * tʼ ** 2) +
      72 * Ψʼ * tʼ ** 2 +
      24 * tʼ ** 4);
  const lngT4 =
    ((χ ** 7 * (1 / cos(Φʼ))) / 5040) *
    (61 + 662 * tʼ ** 2 + 1320 * tʼ ** 4 + 720 * tʼ ** 6);

  // JS works in radians up until here
  const φ = ((Φʼ - latT1 + latT2 - latT3 + latT4) * 180) / π;
  const λ = λ0 + (180 / π) * (lngT1 - lngT2 + lngT3 - lngT4);

  return [λ, φ];
}
