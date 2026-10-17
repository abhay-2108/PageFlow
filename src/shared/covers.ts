export const COVER_IDS = [
  "sunrise",
  "coral",
  "sand",
  "sage",
  "mint",
  "dusk",
  "berry",
  "slate",
] as const;

export type CoverId = (typeof COVER_IDS)[number];

export function isCoverId(value: string): value is CoverId {
  return (COVER_IDS as readonly string[]).includes(value);
}

export function isAssetPath(value: string): boolean {
  return /^assets\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}
