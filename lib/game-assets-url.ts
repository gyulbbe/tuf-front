const DEFAULT_GAME_ASSETS_URL = "https://assets.tufclan.com";
const BASE =
  process.env.NEXT_PUBLIC_GAME_ASSETS_URL ?? DEFAULT_GAME_ASSETS_URL;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function gameAssetUrl(path: string): string {
  return `${normalizeBaseUrl(BASE)}/${path.replace(/^\/+/, "")}`;
}
