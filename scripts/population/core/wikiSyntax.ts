import { T_SOURCE_YEAR, WIKI_TEMPLATES } from "../util";

/**
 * if a wikipedia infobox contains a raw population, it could also
 * include other wiki syntax. We try to strip this out
 */
export const cleanPopStr = (rawStr: string): string =>
  rawStr
    .replace(/(<ref>.+<\/ref>|<ref.+ \/>)/g, "") // references
    .replace(/\(\w+\)([^|]|$)/g, "") // A-Z characters in braces e.g. "(Estimate)", unless there is a | right after the )
    .trim();

export function parseWikiPopDate(_rawPopDate: string): number {
  const rawPopDate = _rawPopDate
    .replace(/(<ref[^>]*>.+<\/ref>|<ref.+\/>)/g, "") // references
    .replace(/ estimate/gi, "")
    .trim();

  // simplest case. See if it's a valid JS date or just a year
  const maybe1 = new Date(rawPopDate).getFullYear();
  if (!Number.isNaN(maybe1)) return maybe1;

  // second case: the value is "{{TEMPLATE_NAME|||y}}", this inserts the source year of the template
  const maybe2 = WIKI_TEMPLATES.map(
    (t) => `{{${t.toLowerCase()}|||y}}`
  ).includes(rawPopDate.toLowerCase());
  if (maybe2) return T_SOURCE_YEAR;

  // third case: see if the value is something like "[[20xx New Zealand|20xx census]]"
  const maybe3 = rawPopDate.match(/(\d{4}) (census|New Zealand)/i)?.[1];
  if (maybe3 && !Number.isNaN(+maybe3)) return +maybe3;

  // we still didn't understand it
  return NaN;
}
