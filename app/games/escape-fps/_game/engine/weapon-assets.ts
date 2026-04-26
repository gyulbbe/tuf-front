import type { WeaponId } from "../lib/weapons";

const WEAPON_IMAGE_SRC: Record<WeaponId, string> = {
  flamethrower: "/games/escape-fps/weapons/flamethrower.svg",
  machinegun: "/games/escape-fps/weapons/machinegun.svg",
  rifle: "/games/escape-fps/weapons/rifle.svg",
};

const weaponImageCache: Partial<Record<WeaponId, HTMLImageElement>> = {};

export function getWeaponImage(weaponId: WeaponId): HTMLImageElement | null {
  if (typeof window === "undefined") {
    return null;
  }

  let image = weaponImageCache[weaponId];

  if (!image) {
    image = new window.Image();
    image.decoding = "async";
    image.src = WEAPON_IMAGE_SRC[weaponId];
    weaponImageCache[weaponId] = image;
  }

  if (!image.complete || image.naturalWidth <= 0) {
    return null;
  }

  return image;
}
