import type { OsmFeature } from "osm-api";

export type Lodge = {
  access: ("Vehicle" | "Boat" | "Foot")[];
  assetId: number;
  hasAlerts: boolean;
  introduction: string;
  introductionAbbreviated: string;
  introductionThumbnail: string;
  name: string;
  occupancy: ("Sole" | "Shared")[];
  status: "OPEN" | "CLSD";
  webPage: `https://www.doc.govt.nz/link/${string}.aspx`;
  $x: number;
  $y: number;
};

export type Hut = {
  /** @deprecated */ OBJECTID: number;
  name: string;
  /** @deprecated */ place: string;
  /** @deprecated */ region: string;
  status: "OPEN" | "CLSD";
  bookable: "No" | "Yes";
  facilities: string;
  /** @deprecated */ hasAlerts: string;
  introductionThumbnail: string;
  staticLink: `https://www.doc.govt.nz/link/${string}.aspx`;
  /** @deprecated */ locationString: string;
  /** @deprecated NZTM */ x: number;
  /** @deprecated NZTM */ y: number;
  assetId: number;
  /** @deprecated ISO Date */ dateLoadedToGIS: string;
  /** @deprecated */ GlobalID: string;
};

export type Campsite = Hut & {
  introduction: string;
  campsiteCategory:
    | "Backcountry"
    | "Standard"
    | "Great Walk"
    | "Basic"
    | "Scenic";
  numberOfPoweredSites: number;
  numberOfUnpoweredSites: number;
  /** @deprecated */ free: null;
  /** @deprecated */ activities: string | null;
  dogsAllowed:
    | "Dogs allowed. Keep dog under control at all times."
    | "Dogs on a leash only"
    | `Dogs with a DOC permit only. ${string}`
    | "No dogs";
  /** @deprecated */ landscape: string;
  /** @deprecated */ access: string;
};

export type GeoJson<T> = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    id: string;
    properties: T;
    geometry:
      | {
          type: "Point";
          coordinates: [lng: number, lat: number];
        }
      | {
          type: "Polygon";
          coordinates: [lng: number, lat: number][][];
        };
  }[];
};

export type LodgeMeta = {
  features: {
    attributes: { EQUIPMENT: number };
    geometry: { x: number; y: number };
  }[];
};

export type OverpassResponse = {
  elements: OsmFeature[];
};
