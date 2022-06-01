export type WikipediaResponse = {
  query: {
    pages: {
      title: string;
      revisions?: [{ slots: { main: { content: string } } }];
    }[];
  };
};

export type WikidataResponse = {
  entities: {
    [QID: string]: {
      type: "item";
      id: string;
      sitelinks: {
        [wikiname: string]: {
          site: string; // e.g. "enwiki" or "simplewikiquote"
          title: string;
          badges: [];
        };
      };
    };
  };
};

export type OverpassResponse = {
  version: 0.6;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  remark?: string;
  elements: {
    timestamp?: string;
    version?: number;
    changeset?: number;
    user?: string;
    uid?: number;
    type: "node";
    id: number;
    lat: number;
    lon: number;

    // all OSM tags we consider are listed here
    tags: {
      wikidata: string; // always exists
      wikipedia?: string;
      population?: string;
      "source:population"?: string;
      "population:date"?: string;
      name?: string;
    };
  }[];
};
