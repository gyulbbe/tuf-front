import { ENEMIES } from "../lib/enemies-config";
import type { Enemy, World } from "../lib/types";
import type { GameState } from "../state/game";
import { damageEnemy, damagePlayer, killEnemy } from "./damage";
import { addEffect } from "./effects";

const LOS_STEP = 0.1;
const ENEMY_COLLISION_RADIUS = 0.2;
const DEAD_REMOVE_MS = 5000;
const BOMBER_SPLASH_RADIUS = 1.5;
const RANGED_SHOT_DURATION_MS = 1200;
const RANGED_PROJECTILE_KEYS: Partial<Record<Enemy["type"], string>> = {
  broodmother: "muzzle-posin5-0",
  burrower: "muzzle-posin2-0",
  impaler: "muzzle-posin1-0",
  overlord: "muzzle-posin5-0",
  spawner: "muzzle-posin3-0",
  spitter: "muzzle-posin0-0",
  tank: "muzzle-posin4-0",
};

function getMapValue(world: World, x: number, y: number): number {
  const row = world.map[Math.floor(y)];

  if (!row) {
    return 1;
  }

  return row[Math.floor(x)] ?? 1;
}

function canOccupy(world: World, x: number, y: number): boolean {
  return (
    getMapValue(world, x - ENEMY_COLLISION_RADIUS, y - ENEMY_COLLISION_RADIUS) === 0 &&
    getMapValue(world, x + ENEMY_COLLISION_RADIUS, y - ENEMY_COLLISION_RADIUS) === 0 &&
    getMapValue(world, x - ENEMY_COLLISION_RADIUS, y + ENEMY_COLLISION_RADIUS) === 0 &&
    getMapValue(world, x + ENEMY_COLLISION_RADIUS, y + ENEMY_COLLISION_RADIUS) === 0
  );
}

export function hasLineOfSight(
  world: World,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.floor(distance / LOS_STEP));

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = fromX + dx * t;
    const y = fromY + dy * t;

    if (getMapValue(world, x, y) !== 0) {
      return false;
    }
  }

  return true;
}

function moveEnemy(
  enemy: Enemy,
  world: World,
  dirX: number,
  dirY: number,
  distance: number,
): void {
  const nextX = enemy.x + dirX * distance;
  const nextY = enemy.y + dirY * distance;

  if (canOccupy(world, nextX, enemy.y)) {
    enemy.x = nextX;
  }

  if (canOccupy(world, enemy.x, nextY)) {
    enemy.y = nextY;
  }
}

function attackPlayer(
  enemy: Enemy,
  world: World,
  game: GameState,
  now: number,
): void {
  const config = ENEMIES[enemy.type];
  const dx = world.player.pos.x - enemy.x;
  const dy = world.player.pos.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  const canMelee =
    (config.attack === "melee" || config.attack === "hybrid") &&
    distance <= (config.meleeRange ?? config.attackRange);
  const canRanged =
    (config.attack === "ranged" || config.attack === "hybrid") &&
    distance <= config.attackRange &&
    hasLineOfSight(world, enemy.x, enemy.y, world.player.pos.x, world.player.pos.y);
  const canSuicide = config.attack === "suicide" && distance <= config.attackRange;

  if (!canMelee && !canRanged && !canSuicide) {
    return;
  }

  if (config.attack !== "suicide" && now - enemy.lastAttackAt < config.attackCooldownMs) {
    return;
  }

  enemy.lastAttackAt = now;

  if (canRanged && !canMelee) {
    addEffect({
      data: {
        enemy: enemy.type,
        from: { x: enemy.x, y: enemy.y },
        projectileKey: RANGED_PROJECTILE_KEYS[enemy.type],
        to: { ...world.player.pos },
      },
      durationMs: RANGED_SHOT_DURATION_MS,
      type: "enemy-shot",
    });
  }

  damagePlayer(game, canMelee ? config.meleeDamage ?? config.damage : config.damage, now);

  if (config.attack !== "suicide") {
    return;
  }

  enemy.hp = 0;
  killEnemy(enemy, world, game, now);

  for (const otherEnemy of world.enemies) {
    if (otherEnemy === enemy || otherEnemy.state === "dead") {
      continue;
    }

    const splashDistance = Math.hypot(otherEnemy.x - enemy.x, otherEnemy.y - enemy.y);

    if (splashDistance <= BOMBER_SPLASH_RADIUS) {
      damageEnemy(otherEnemy, config.damage * 0.5, world, game, now);
    }
  }
}

function separateEnemies(world: World): void {
  for (let index = 0; index < world.enemies.length; index += 1) {
    const enemy = world.enemies[index];

    if (!enemy || enemy.state === "dead") {
      continue;
    }

    for (let otherIndex = index + 1; otherIndex < world.enemies.length; otherIndex += 1) {
      const other = world.enemies[otherIndex];

      if (!other || other.state === "dead") {
        continue;
      }

      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= 0 || distance >= 0.42) {
        continue;
      }

      const push = (0.42 - distance) * 0.025;
      const nx = dx / distance;
      const ny = dy / distance;

      if (canOccupy(world, enemy.x - nx * push, enemy.y - ny * push)) {
        enemy.x -= nx * push;
        enemy.y -= ny * push;
      }

      if (canOccupy(world, other.x + nx * push, other.y + ny * push)) {
        other.x += nx * push;
        other.y += ny * push;
      }
    }
  }
}

export function tickEnemies(
  deltaSeconds: number,
  now: number,
  world: World,
  game: GameState,
): void {
  if (game.phase !== "playing") {
    return;
  }

  for (const enemy of world.enemies) {
    if (enemy.state === "dead") {
      continue;
    }

    const config = ENEMIES[enemy.type];
    const dx = world.player.pos.x - enemy.x;
    const dy = world.player.pos.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const canSeePlayer =
      distance <= config.sightRange &&
      hasLineOfSight(world, enemy.x, enemy.y, world.player.pos.x, world.player.pos.y);

    if (canSeePlayer) {
      enemy.state = "chase";
    }

    if (enemy.state !== "chase") {
      continue;
    }

    attackPlayer(enemy, world, game, now);

    if (game.phase !== "playing") {
      return;
    }

    if (enemy.hp <= 0 || config.stationary || config.speed <= 0) {
      continue;
    }

    const stopRange =
      config.attack === "hybrid"
        ? Math.max((config.meleeRange ?? 1) * 0.85, 0.35)
        : Math.max(config.attackRange * 0.75, 0.35);

    if (distance <= stopRange) {
      continue;
    }

    const dirX = distance > 0 ? dx / distance : 0;
    const dirY = distance > 0 ? dy / distance : 0;

    moveEnemy(enemy, world, dirX, dirY, config.speed * deltaSeconds);
  }

  separateEnemies(world);
  world.enemies = world.enemies.filter((enemy) => {
    if (enemy.state !== "dead") {
      return true;
    }

    return enemy.deadAt === undefined || now - enemy.deadAt <= DEAD_REMOVE_MS;
  });
}
