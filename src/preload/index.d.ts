import type { PagegroveApi } from "../shared/api";

declare global {
  interface Window {
    readonly pagegrove: PagegroveApi;
  }
}

export {};
