import { promises as fs } from "fs";

export const chunk = <T>(list: T[], size: number): T[][] =>
  list.reduce<T[][]>(
    (r, v) =>
      ((!r.length || r[r.length - 1].length === size
        ? r.push([v])
        : r[r.length - 1].push(v)) && r) as T[][],
    []
  );

export const timeout = (ms: number): Promise<void> =>
  new Promise((cb) => setTimeout(cb, ms));

/** safely reads a file on disk. If it doesn't exist, returns the fallback value */
export async function tryRead<T>(fileName: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(fileName, "utf8"));
  } catch {
    return fallback;
  }
}

/** returns the real article name from the OSM tag value, iff it's valid */
export const validateOSMWikiTag = (
  wikipediaTag: string | undefined
): string | undefined => {
  if (!wikipediaTag) return undefined;
  const [lang, pageName] = wikipediaTag.split(":");

  // if the tag value is broken, or it points to a non-english wikipedia,
  // then it's useless to us.
  if (lang !== "en" || !pageName) return undefined;

  // if the wikipedia link points to a section of a page, it's not going to be useful to us
  if (pageName.includes("#")) return undefined;

  return pageName;
};

/**
 * Wikipedians are inconsitent with macrons, capitalization etc.
 * This normalizes the names being looked up in the template.
 * */
export const normalizeStatsNzName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
