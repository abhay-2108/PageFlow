import type { PagegroveApi } from "../../../shared/api";

export function getApi(): PagegroveApi {
  const api = window.pagegrove;
  if (!api) {
    throw new Error("Pagegrove bridge is unavailable");
  }
  return api;
}
