import type { WeaponId } from "../lib/weapons";

export type InventoryState = {
  ammo: Record<WeaponId, number>;
  current: WeaponId;
  isAiming: boolean;
  isReloading: boolean;
  lastFireAt: number;
  muzzleFlashUntil: number;
  owned: Set<WeaponId>;
  reloadEndAt: number;
};

export function createInitialInventory(): InventoryState {
  return {
    ammo: {
      flamethrower: 0,
      machinegun: 30,
      rifle: 0,
    },
    current: "machinegun",
    isAiming: false,
    isReloading: false,
    lastFireAt: Number.NEGATIVE_INFINITY,
    muzzleFlashUntil: 0,
    owned: new Set<WeaponId>(["machinegun"]),
    reloadEndAt: 0,
  };
}
