export function assetUrl(src: string): string {
  return `pgfile:///${src.replace(/^\/+/, "")}`;
}
