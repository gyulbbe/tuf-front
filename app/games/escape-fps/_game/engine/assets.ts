import { spriteUrl } from "../lib/assets-url";
import { ENEMY_IMAGE_KEYS } from "../lib/enemies-config";

export type ImageAssets = Record<string, HTMLImageElement | null>;

const OPTIONAL_IMAGE_KEYS: ReadonlySet<string> = new Set(["muzzle-flash-0"]);

export const WEAPON_IMAGE_KEYS: string[] = [
  "weapon-machinegun-0",
  "weapon-rifle-0",
  "weapon-flamethrower-0",
  "muzzle-flash-0",
];

export const PROJECTILE_IMAGE_KEYS: string[] = [
  "muzzle-posin0-0",
  "muzzle-posin1-0",
  "muzzle-posin2-0",
  "muzzle-posin3-0",
  "muzzle-posin4-0",
  "muzzle-posin5-0",
];

export const ENVIRONMENT_IMAGE_KEYS: string[] = ["door-0"];

export const GAME_IMAGE_KEYS: string[] = [
  ...ENEMY_IMAGE_KEYS,
  ...WEAPON_IMAGE_KEYS,
  ...PROJECTILE_IMAGE_KEYS,
  ...ENVIRONMENT_IMAGE_KEYS,
];

function loadImage(
  key: string,
  isOptional: boolean,
): Promise<[string, HTMLImageElement | null]> {
  return new Promise((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.onload = (): void => resolve([key, image]);
    image.onerror = (): void => {
      if (!isOptional) {
        console.warn(`[escape-fps] failed to load image: ${key}`);
      }

      resolve([key, null]);
    };
    image.src = spriteUrl(key);
  });
}

export async function loadImages(keys: string[]): Promise<ImageAssets> {
  const entries = await Promise.all(
    keys.map((key) => loadImage(key, OPTIONAL_IMAGE_KEYS.has(key))),
  );

  return Object.fromEntries(entries);
}
