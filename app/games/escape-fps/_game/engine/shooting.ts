import {
  MUZZLE_FLASH_MS,
  RELOAD_DURATION_MS,
} from "../lib/constants";
import { WEAPON_EFFECTS } from "../lib/effects-config";
import type { KeyboardInput, World } from "../lib/types";
import type { Vec2 } from "../lib/types";
import { WEAPONS } from "../lib/weapons";
import type { WeaponId } from "../lib/weapons";
import type { GameState } from "../state/game";
import type { InventoryState } from "../state/inventory";
import { applyBulletShot, applyFlamethrowerDamage } from "./damage";
import { addEffect } from "./effects";

function addScaled(origin: Vec2, dir: Vec2, distance: number): Vec2 {
  return {
    x: origin.x + dir.x * distance,
    y: origin.y + dir.y * distance,
  };
}

function completeReloadIfReady(inventory: InventoryState, now: number): void {
  if (!inventory.isReloading || inventory.reloadEndAt > now) {
    return;
  }

  const weapon = WEAPONS[inventory.current];

  if (weapon.clipSize !== null) {
    inventory.ammo[inventory.current] = weapon.clipSize;
  }

  inventory.isReloading = false;
  inventory.reloadEndAt = 0;
}

function startReload(inventory: InventoryState, now: number): void {
  const weapon = WEAPONS[inventory.current];

  if (
    weapon.clipSize === null ||
    inventory.isReloading ||
    inventory.ammo[inventory.current] >= weapon.clipSize
  ) {
    return;
  }

  inventory.isReloading = true;
  inventory.reloadEndAt = now + RELOAD_DURATION_MS;
}

function switchWeapon(inventory: InventoryState, weaponId: WeaponId): void {
  if (!inventory.owned.has(weaponId) || inventory.isReloading) {
    return;
  }

  inventory.current = weaponId;
  inventory.isAiming = false;
}

function fireWeapon(
  inventory: InventoryState,
  world: World,
  game: GameState,
  now: number,
): void {
  const weapon = WEAPONS[inventory.current];

  if (weapon.clipSize !== null) {
    inventory.ammo[inventory.current] = Math.max(
      0,
      inventory.ammo[inventory.current] - 1,
    );
  }

  inventory.lastFireAt = now;
  inventory.muzzleFlashUntil = now + MUZZLE_FLASH_MS;

  const effects = WEAPON_EFFECTS[inventory.current];

  if (effects.muzzleFlash.size > 0) {
    addEffect({
      data: { weapon: inventory.current },
      durationMs: effects.muzzleFlash.durationMs,
      type: "muzzle-flash",
    });
  }

  if (effects.screenShake.magnitude > 0) {
    addEffect({
      data: { magnitude: effects.screenShake.magnitude },
      durationMs: effects.screenShake.durationMs,
      type: "screen-shake",
    });
  }

  if (inventory.current === "flamethrower") {
    return;
  }

  const result = applyBulletShot(inventory.current, world, game, now);
  const tracerEnd =
    result.kind === "decoration" || result.kind === "enemy" || result.kind === "wall"
      ? result.pos
      : addScaled(world.player.pos, world.player.dir, weapon.range);

  if (effects.tracer) {
    addEffect({
      data: {
        from: { ...world.player.pos },
        to: tracerEnd,
        weapon: inventory.current,
      },
      durationMs: effects.tracer.durationMs,
      type: "tracer",
    });
  }

  if (result.kind === "wall") {
    addEffect({
      data: { pos: result.pos, weapon: inventory.current },
      durationMs: 250,
      type: "wall-spark",
    });
  }

  if (result.kind === "enemy") {
    addEffect({
      data: { pos: result.pos, scale: 0.5 },
      durationMs: 400,
      type: "blood-splat",
    });
  }
}

export function tickShooting(
  deltaSeconds: number,
  now: number,
  input: KeyboardInput,
  inventory: InventoryState,
  world: World,
  game: GameState,
): void {
  world.impactMarks = world.impactMarks.filter((mark) => mark.removeAt > now);
  completeReloadIfReady(inventory, now);

  if (input.consumeReloadTriggered()) {
    startReload(inventory, now);
  }

  if (input.consumeAimTriggered() && !inventory.isReloading) {
    inventory.isAiming = !inventory.isAiming;
  }

  const switchTriggered = input.consumeSwitchTriggered();

  if (switchTriggered) {
    switchWeapon(inventory, switchTriggered);
  }

  const weapon = WEAPONS[inventory.current];
  const fireTriggered = input.consumeFireTriggered();
  const wantsFire = weapon.autoFire ? input.isFiring() : fireTriggered;
  const hasAmmo =
    weapon.clipSize === null || inventory.ammo[inventory.current] > 0;

  if (
    !wantsFire ||
    inventory.isReloading ||
    !hasAmmo ||
    now - inventory.lastFireAt < weapon.fireRateMs
  ) {
    if (
      wantsFire &&
      inventory.current === "flamethrower" &&
      !inventory.isReloading
    ) {
      applyFlamethrowerDamage(deltaSeconds, world, game, now);
    }

    return;
  }

  fireWeapon(inventory, world, game, now);

  if (inventory.current === "flamethrower") {
    applyFlamethrowerDamage(deltaSeconds, world, game, now);
  }
}
