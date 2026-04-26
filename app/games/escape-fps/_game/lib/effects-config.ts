import type { WeaponId } from "./weapons";

export type WeaponEffectConfig = {
  muzzleFlash: {
    color: string;
    durationMs: number;
    size: number;
  };
  screenShake: {
    durationMs: number;
    magnitude: number;
  };
  tracer: {
    color: string;
    durationMs: number;
    widthPx: number;
  } | null;
  wallSpark: {
    color: string;
    sizeRange: [number, number];
  };
};

export const WEAPON_EFFECTS: Record<WeaponId, WeaponEffectConfig> = {
  flamethrower: {
    muzzleFlash: { color: "#ff7822", durationMs: 0, size: 0 },
    screenShake: { durationMs: 0, magnitude: 0 },
    tracer: null,
    wallSpark: { color: "#aa3300", sizeRange: [3, 6] },
  },
  machinegun: {
    muzzleFlash: { color: "#ffd54a", durationMs: 50, size: 60 },
    screenShake: { durationMs: 60, magnitude: 1 },
    tracer: { color: "rgba(255,220,140,0.7)", durationMs: 80, widthPx: 2 },
    wallSpark: { color: "#aaaaaa", sizeRange: [4, 8] },
  },
  rifle: {
    muzzleFlash: { color: "#ffffff", durationMs: 90, size: 110 },
    screenShake: { durationMs: 200, magnitude: 6 },
    tracer: { color: "rgba(255,255,255,0.85)", durationMs: 140, widthPx: 3 },
    wallSpark: { color: "#dddddd", sizeRange: [10, 18] },
  },
};
