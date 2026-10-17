interface PagegroveApi {
  readonly platform: string;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
}

interface Window {
  readonly pagegrove: PagegroveApi;
}
