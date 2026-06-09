import { gameAssetUrl } from "@/lib/game-assets-url";

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
  return gameAssetUrl(`escape-fps/${folderForKey(key)}/${key}.png`);
}
