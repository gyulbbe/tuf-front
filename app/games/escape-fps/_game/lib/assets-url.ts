const DEFAULT_GAME_ASSETS_URL = "https://assets.tufclan.com";
const BASE =
  process.env.NEXT_PUBLIC_GAME_ASSETS_URL ?? DEFAULT_GAME_ASSETS_URL;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function folderForKey(key: string): string {
  if (key.startsWith("enemy-")) {
    return "enemy";
  }

  if (key.startsWith("weapon-")) {
    return "weapon";
  }

  if (key.startsWith("muzzle-")) {
    return "muzzle";
  }

  if (key.startsWith("door-")) {
    return "environment";
  }

  return "misc";
}

export function spriteUrl(key: string): string {
  return `${normalizeBaseUrl(BASE)}/escape-fps/${folderForKey(key)}/${key}.png`;
}
