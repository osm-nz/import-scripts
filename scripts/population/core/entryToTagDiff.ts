import type { OverpassResponse } from "../util";
import type { Entry } from "./conflate";

type Tags = Partial<
  Record<keyof OverpassResponse["elements"][0]["tags"], string | number>
>;

export function entryToTagDiff(entry: Entry): Tags {
  const tags: Tags = {};

  if (entry.changes?.name) tags.name = entry.changes.name;
  if (entry.changes?.pop) tags.population = entry.changes.pop;
  if (entry.changes?.popDate) tags["population:date"] = entry.changes.popDate;
  if (entry.changes?.popSrc) tags["source:population"] = entry.changes.popSrc;
  if (entry.changes?.wp) tags.wikipedia = entry.changes.wp;

  return tags;
}
