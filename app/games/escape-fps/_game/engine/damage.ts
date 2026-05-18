import { ENEMIES } from "../lib/enemies-config";
import type { EnemyId } from "../lib/enemies-config";
import type { Decoration, Enemy, Vec2, World } from "../lib/types";
import { WEAPONS } from "../lib/weapons";
import type { WeaponId } from "../lib/weapons";
import type { GameState } from "../state/game";
import { addEffect } from "./effects";

const ENEMY_HIT_RADIUS = 0.4;
const DECORATION_HIT_RADIUS = 0.38;
const SHOT_STEP = 0.06;
const HURT_FLASH_MS = 120;
const FLAME_RANGE = 4.5;
const FLAME_HALF_ANGLE_COS = Math.cos((52 * Math.PI) / 180);
const WEAPON_DAMAGE: Record<WeaponId, number> = {
  flamethrower: 72,
  machinegun: 8,
  rifle: 60,
};

export type ShotResult =
  | { decoration: Decoration; kind: "decoration"; pos: Vec2 }
  | { kind: "enemy"; enemy: Enemy; pos: Vec2 }
  | { kind: "miss" }
  | { kind: "wall"; pos: Vec2 };

function getMapValue(world: World, x: number, y: number): number {
  const row = world.map[Math.floor(y)];

  if (!row) {
    return 1;
  }

  return row[Math.floor(x)] ?? 1;
}

function isAlive(enemy: Enemy): boolean {
  return enemy.state !== "dead" && enemy.hp > 0;
}

function isBreakable(decoration: Decoration): boolean {
  return !decoration.broken && decoration.hp !== undefined && decoration.hp > 0;
}

function isWall(world: World, x: number, y: number): boolean {
  return getMapValue(world, x, y) !== 0;
}

function createSpawnedEnemy(
  type: EnemyId,
  x: number,
  y: number,
  spawnedFrom: string,
  index: number,
): Enemy {
  return {
    hp: ENEMIES[type].hp,
    hurtFlashUntil: 0,
    id: `${spawnedFrom}-${type}-${index}-${Math.round(x * 10)}-${Math.round(y * 10)}`,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    spawnedFrom,
    state: "chase",
    type,
    x,
    y,
  };
}

function findSpawnPosition(
  world: World,
  origin: Enemy,
  index: number,
): Vec2 {
  const angle = (index / 8) * Math.PI * 2;
  const radius = 0.65 + (index % 3) * 0.18;
  const x = origin.x + Math.cos(angle) * radius;
  const y = origin.y + Math.sin(angle) * radius;

  if (isWall(world, x, y)) {
    return { x: origin.x, y: origin.y };
  }

  return { x, y };
}

export function killEnemy(
  enemy: Enemy,
  world: World,
  game: GameState,
  now: number,
): void {
  if (enemy.state === "dead") {
    return;
  }

  const config = ENEMIES[enemy.type];

  enemy.hp = 0;
  enemy.state = "dead";
  enemy.deadAt = now;
  game.killCount += 1;
  game.score += config.score;

  addEffect({
    data: { pos: { x: enemy.x, y: enemy.y }, scale: 1 },
    durationMs: 800,
    type: "blood-splat",
  });

  if (enemy.type === "bomber" || enemy.type === "broodmother") {
    const radius = enemy.type === "broodmother" ? 2.5 : 1.5;
    const magnitude = enemy.type === "broodmother" ? 16 : 12;

    addEffect({
      data: { pos: { x: enemy.x, y: enemy.y }, radius },
      durationMs: enemy.type === "broodmother" ? 850 : 600,
      type: "explosion",
    });
    addEffect({
      data: { magnitude },
      durationMs: enemy.type === "broodmother" ? 500 : 350,
      type: "screen-shake",
    });
  }

  if (!config.onDeathSpawn) {
    return;
  }

  for (let index = 0; index < config.onDeathSpawn.count; index += 1) {
    const pos = findSpawnPosition(world, enemy, index);

    world.enemies.push(
      createSpawnedEnemy(
        config.onDeathSpawn.type,
        pos.x,
        pos.y,
        enemy.id,
        index,
      ),
    );
  }
}

export function damageEnemy(
  enemy: Enemy,
  amount: number,
  world: World,
  game: GameState,
  now: number,
): void {
  if (!isAlive(enemy)) {
    return;
  }

  enemy.hp -= amount;
  enemy.hurtFlashUntil = now + HURT_FLASH_MS;
  enemy.state = "chase";

  if (enemy.hp <= 0) {
    killEnemy(enemy, world, game, now);
  }
}

function addDroppedWeapon(decoration: Decoration, world: World): void {
  if (!decoration.dropWeapon) {
    return;
  }

  world.pickups.push({
    id: `${decoration.id}-weapon-drop`,
    taken: false,
    type: decoration.dropWeapon,
    x: decoration.x,
    y: decoration.y,
  });
}

function addDroppedHealth(decoration: Decoration, world: World): void {
  if (!decoration.dropHealth) {
    return;
  }

  world.healthPickups.push({
    amount: decoration.dropHealth,
    id: `${decoration.id}-health-drop`,
    taken: false,
    x: decoration.x,
    y: decoration.y,
  });
}

function breakDecoration(
  decoration: Decoration,
  world: World,
  weaponId: WeaponId,
  now: number,
): void {
  decoration.broken = true;
  decoration.hp = 0;

  addDroppedWeapon(decoration, world);
  addDroppedHealth(decoration, world);

  addEffect({
    data: { pos: { x: decoration.x, y: decoration.y }, weapon: weaponId },
    durationMs: 220,
    type: "wall-spark",
  });

  if (decoration.kind === "barrel") {
    addEffect({
      data: { pos: { x: decoration.x, y: decoration.y }, radius: 0.55 },
      durationMs: 320,
      type: "explosion",
    });
    addEffect({
      data: { magnitude: 3 },
      durationMs: 120,
      type: "screen-shake",
    });
  }

  decoration.hurtFlashUntil = now + HURT_FLASH_MS;
}

function damageDecoration(
  decoration: Decoration,
  amount: number,
  world: World,
  weaponId: WeaponId,
  now: number,
): void {
  if (!isBreakable(decoration)) {
    return;
  }

  decoration.hp = Math.max(0, (decoration.hp ?? 0) - amount);
  decoration.hurtFlashUntil = now + HURT_FLASH_MS;

  if (decoration.hp <= 0) {
    breakDecoration(decoration, world, weaponId, now);
  }
}

export function damagePlayer(
  game: GameState,
  amount: number,
  now: number,
): void {
  if (game.phase !== "playing" || game.isInvincible || game.playerHp <= 0) {
    return;
  }

  game.playerHp = Math.max(0, game.playerHp - amount);
  game.hurtFlashUntil = now + 250;

  if (game.playerHp <= 0) {
    game.phase = "gameover";
    game.endedAt = now;
  }
}

export function castShot(
  origin: Vec2,
  dir: Vec2,
  range: number,
  world: World,
): ShotResult {
  const enemyRadiusSquared = ENEMY_HIT_RADIUS * ENEMY_HIT_RADIUS;
  const decorationRadiusSquared = DECORATION_HIT_RADIUS * DECORATION_HIT_RADIUS;

  for (let distance = SHOT_STEP; distance <= range; distance += SHOT_STEP) {
    const x = origin.x + dir.x * distance;
    const y = origin.y + dir.y * distance;

    if (isWall(world, x, y)) {
      return { kind: "wall", pos: { x, y } };
    }

    for (const enemy of world.enemies) {
      if (!isAlive(enemy)) {
        continue;
      }

      const dx = enemy.x - x;
      const dy = enemy.y - y;

      if (dx * dx + dy * dy <= enemyRadiusSquared) {
        return { enemy, kind: "enemy", pos: { x, y } };
      }
    }

    for (const decoration of world.decorations) {
      if (!isBreakable(decoration)) {
        continue;
      }

      const dx = decoration.x - x;
      const dy = decoration.y - y;

      if (dx * dx + dy * dy <= decorationRadiusSquared) {
        return { decoration, kind: "decoration", pos: { x, y } };
      }
    }
  }

  return { kind: "miss" };
}

export function applyBulletShot(
  weaponId: WeaponId,
  world: World,
  game: GameState,
  now: number,
): ShotResult {
  const weapon = WEAPONS[weaponId];
  const result = castShot(world.player.pos, world.player.dir, weapon.range, world);

  if (result.kind === "enemy") {
    damageEnemy(result.enemy, WEAPON_DAMAGE[weaponId], world, game, now);
    return result;
  }

  if (result.kind === "decoration") {
    damageDecoration(result.decoration, WEAPON_DAMAGE[weaponId], world, weaponId, now);
    return result;
  }

  if (result.kind !== "wall") {
    return result;
  }

  return result;
}

export function applyFlamethrowerDamage(
  deltaSeconds: number,
  world: World,
  game: GameState,
  now: number,
): void {
  const damage = WEAPON_DAMAGE.flamethrower * deltaSeconds;

  for (const enemy of world.enemies) {
    if (!isAlive(enemy)) {
      continue;
    }

    const dx = enemy.x - world.player.pos.x;
    const dy = enemy.y - world.player.pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0 || distance > FLAME_RANGE) {
      continue;
    }

    const dot = (dx / distance) * world.player.dir.x + (dy / distance) * world.player.dir.y;

    if (dot < FLAME_HALF_ANGLE_COS) {
      continue;
    }

    damageEnemy(enemy, damage, world, game, now);
  }

  for (const decoration of world.decorations) {
    if (!isBreakable(decoration)) {
      continue;
    }

    const dx = decoration.x - world.player.pos.x;
    const dy = decoration.y - world.player.pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0 || distance > FLAME_RANGE) {
      continue;
    }

    const dot =
      (dx / distance) * world.player.dir.x +
      (dy / distance) * world.player.dir.y;

    if (dot < FLAME_HALF_ANGLE_COS) {
      continue;
    }

    damageDecoration(decoration, damage, world, "flamethrower", now);
  }
}
