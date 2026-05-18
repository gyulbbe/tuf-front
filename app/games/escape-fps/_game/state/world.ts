import { CAMERA_PLANE_LENGTH } from "../lib/constants";
import { ENEMIES } from "../lib/enemies-config";
import type { EnemyId } from "../lib/enemies-config";
import type {
  Decoration,
  Enemy,
  HealthPickup,
  Pickup,
  Player,
  Vec2,
  World,
  WorldMap,
} from "../lib/types";

export const MAX_FLOOR = 5;
export const PLAYER_START: Vec2 = { x: 6.5, y: 6.5 };
export const EXIT_RADIUS = 0.8;

type EnemySpawn = {
  id: string;
  type: EnemyId;
  x: number;
  y: number;
};

type StageLayout = {
  exit: Vec2;
  map: WorldMap;
  size: number;
};

const FLOOR_SIZES: Record<number, number> = {
  1: 26,
  2: 31,
  3: 36,
  4: 48,
  5: 56,
};

const FLOOR_ENEMY_HP_MULTIPLIER: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1.08,
  4: 1.2,
  5: 1.35,
};

function createEnemy(
  id: string,
  type: EnemyId,
  x: number,
  y: number,
  floor: number,
): Enemy {
  return {
    hp: Math.ceil(ENEMIES[type].hp * (FLOOR_ENEMY_HP_MULTIPLIER[floor] ?? 1)),
    hurtFlashUntil: 0,
    id,
    lastAttackAt: Number.NEGATIVE_INFINITY,
    state: "idle",
    type,
    x,
    y,
  };
}

function carveRoom(
  map: number[][],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  wallValue: number,
): void {
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const isWall = x === minX || x === maxX || y === minY || y === maxY;

      map[y][x] = isWall ? wallValue : 0;
    }
  }
}

function carveHorizontalCorridor(
  map: number[][],
  y: number,
  minX: number,
  maxX: number,
): void {
  for (let x = minX; x <= maxX; x += 1) {
    map[y][x] = 0;

    if (map[y - 1]) {
      map[y - 1][x] = map[y - 1][x] === 0 ? 0 : 3;
    }

    if (map[y + 1]) {
      map[y + 1][x] = map[y + 1][x] === 0 ? 0 : 3;
    }
  }
}

function carveVerticalCorridor(
  map: number[][],
  x: number,
  minY: number,
  maxY: number,
): void {
  for (let y = minY; y <= maxY; y += 1) {
    map[y][x] = 0;
    map[y][x - 1] = map[y][x - 1] === 0 ? 0 : 3;
    map[y][x + 1] = map[y][x + 1] === 0 ? 0 : 3;
  }
}

function createStageLayout(floor: number): StageLayout {
  const size = FLOOR_SIZES[floor] ?? FLOOR_SIZES[1];
  const map = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      x === 0 || y === 0 || x === size - 1 || y === size - 1 ? 1 : 1,
    ),
  );
  const midY = Math.floor(size * 0.5);
  const finalMinX = Math.max(14, size - 13);
  const finalMinY = Math.max(13, size - 12);

  carveRoom(map, 2, 2, 12, 10, 2);
  carveVerticalCorridor(map, 8, 10, midY + 2);
  carveRoom(map, 3, midY - 4, 16, midY + 4, floor >= 3 ? 3 : 2);
  carveHorizontalCorridor(map, 6, 12, 14);
  carveVerticalCorridor(map, 14, 6, midY);
  carveHorizontalCorridor(map, midY, 16, finalMinX + 1);
  carveRoom(map, finalMinX, finalMinY, size - 2, size - 2, floor >= 4 ? 3 : 2);
  carveVerticalCorridor(map, finalMinX + 2, midY, finalMinY);

  if (floor >= 2) {
    carveRoom(map, size - 12, 3, size - 3, 11, 2);
    carveHorizontalCorridor(map, 7, 12, size - 12);
  }

  if (floor >= 3) {
    carveRoom(map, 3, size - 11, 14, size - 3, 3);
    carveHorizontalCorridor(map, size - 7, 8, finalMinX);
  }

  if (floor >= 4) {
    carveRoom(map, 18, 3, Math.min(size - 4, 29), 12, 3);
    carveVerticalCorridor(map, 23, 12, midY);
  }

  if (floor >= 5) {
    carveRoom(map, size - 22, midY + 4, size - 10, midY + 13, 3);
    carveHorizontalCorridor(map, midY + 8, 16, finalMinX + 2);
    carveVerticalCorridor(map, finalMinX + 2, midY, finalMinY);
  }

  const exit: Vec2 = { x: size - 4.5, y: size - 4.5 };
  const exitTileX = Math.floor(exit.x);
  const exitTileY = Math.floor(exit.y);

  map[exitTileY][exitTileX] = 0;

  return { exit, map, size };
}

function createEnemySpawns(floor: number, size: number): EnemySpawn[] {
  if (floor === 1) {
    return [
      { id: "f1-grub-1", type: "grub", x: 8.5, y: 14.5 },
      { id: "f1-grub-2", type: "grub", x: 12.5, y: 15.5 },
      { id: "f1-swarmling-1", type: "swarmling", x: 15.5, y: 13.5 },
      { id: "f1-runner-1", type: "runner", x: size - 7.5, y: size - 6.5 },
    ];
  }

  if (floor === 2) {
    return [
      { id: "f2-runner-1", type: "runner", x: 8.5, y: 17.5 },
      { id: "f2-runner-2", type: "runner", x: 15.5, y: 16.5 },
      { id: "f2-bomber-1", type: "bomber", x: size - 8.5, y: 7.5 },
      { id: "f2-spitter-1", type: "spitter", x: size - 7.5, y: size - 7.5 },
      { id: "f2-leaper-1", type: "leaper", x: size - 10.5, y: size - 5.5 },
    ];
  }

  if (floor === 3) {
    return [
      { id: "f3-bomber-1", type: "bomber", x: 12.5, y: 18.5 },
      { id: "f3-bomber-2", type: "bomber", x: size - 10.5, y: size - 5.5 },
      { id: "f3-spitter-1", type: "spitter", x: 20.5, y: 18.5 },
      { id: "f3-impaler-1", type: "impaler", x: size - 8.5, y: 8.5 },
      { id: "f3-host-1", type: "host", x: 8.5, y: size - 7.5 },
      { id: "f3-burrower-1", type: "burrower", x: size - 8.5, y: size - 8.5 },
      { id: "f3-leaper-1", type: "leaper", x: 10.5, y: 16.5 },
      { id: "f3-spitter-2", type: "spitter", x: size - 6.5, y: size - 9.5 },
    ];
  }

  if (floor === 4) {
    return [
      { id: "f4-bomber-2", type: "bomber", x: 10.5, y: 23.5 },
      { id: "f4-leaper-1", type: "leaper", x: 14.5, y: 25.5 },
      { id: "f4-impaler-1", type: "impaler", x: 21.5, y: 8.5 },
      { id: "f4-impaler-2", type: "impaler", x: 25.5, y: 10.5 },
      { id: "f4-spawner-1", type: "spawner", x: 28.5, y: 8.5 },
      { id: "f4-burrower-1", type: "burrower", x: 26.5, y: 7.5 },
      { id: "f4-bomber-1", type: "bomber", x: 23.5, y: 18.5 },
      { id: "f4-host-1", type: "host", x: 8.5, y: size - 8.5 },
      { id: "f4-host-2", type: "host", x: 12.5, y: size - 5.5 },
      { id: "f4-spitter-1", type: "spitter", x: size - 7.5, y: size - 7.5 },
      { id: "f4-charger-1", type: "charger", x: size - 10.5, y: size - 8.5 },
      { id: "f4-charger-2", type: "charger", x: size - 8.5, y: size - 4.5 },
      { id: "f4-tank-1", type: "tank", x: size - 5.5, y: size - 9.5 },
      { id: "f4-tank-2", type: "tank", x: size - 5.5, y: size - 4.5 },
    ];
  }

  return [
    { id: "f5-impaler-3", type: "impaler", x: 13.5, y: Math.floor(size * 0.5) + 0.5 },
    { id: "f5-tank-1", type: "tank", x: 23.5, y: 8.5 },
    { id: "f5-tank-2", type: "tank", x: 26.5, y: 5.5 },
    { id: "f5-impaler-1", type: "impaler", x: 28.5, y: 10.5 },
    { id: "f5-impaler-2", type: "impaler", x: 20.5, y: 10.5 },
    { id: "f5-spawner-1", type: "spawner", x: 9.5, y: size - 8.5 },
    { id: "f5-spawner-2", type: "spawner", x: size - 17.5, y: Math.floor(size * 0.5) + 9.5 },
    { id: "f5-burrower-1", type: "burrower", x: 8.5, y: size - 7.5 },
    { id: "f5-charger-3", type: "charger", x: size - 15.5, y: Math.floor(size * 0.5) + 8.5 },
    { id: "f5-charger-1", type: "charger", x: size - 11.5, y: size - 8.5 },
    { id: "f5-charger-2", type: "charger", x: size - 5.5, y: size - 8.5 },
    { id: "f5-tank-4", type: "tank", x: size - 11.5, y: Math.floor(size * 0.5) + 10.5 },
    { id: "f5-tank-3", type: "tank", x: size - 9.5, y: size - 4.5 },
    { id: "f5-spitter-1", type: "spitter", x: size - 10.5, y: size - 7.5 },
    { id: "f5-overlord-1", type: "overlord", x: size - 4.5, y: size - 5.5 },
    { id: "f5-broodmother-1", type: "broodmother", x: size - 6.5, y: size - 6.5 },
  ];
}

function createWeaponPickups(floor: number, size: number): Pickup[] {
  void floor;
  void size;

  return [];
}

function createHealthPickups(floor: number, size: number): HealthPickup[] {
  void floor;
  void size;

  return [];
}

function createDecorations(floor: number, size: number): Decoration[] {
  if (floor === 1) {
    return [
      { floor, hp: 12, id: "f1-box-1", kind: "box", scale: 0.42, x: 4.5, y: 4.5 },
      { floor, hp: 12, id: "f1-box-2", kind: "box", scale: 0.46, x: 11.5, y: 8.5 },
      { dropHealth: 65, floor, hp: 8, id: "f1-barrel-1", kind: "barrel", scale: 0.36, x: 6.5, y: 15.5 },
      { floor, hp: 8, id: "f1-barrel-2", kind: "barrel", scale: 0.36, x: 10.5, y: 16.5 },
      { floor, hp: 12, id: "f1-box-3", kind: "box", scale: 0.5, x: size - 9.5, y: size - 9.5 },
      { floor, hp: 8, id: "f1-barrel-3", kind: "barrel", scale: 0.4, x: size - 5.5, y: size - 7.5 },
    ];
  }

  if (floor === 2) {
    return [
      { floor, hp: 10, id: "f2-tube-1", kind: "test-tube", scale: 0.62, x: 5.5, y: 18.5 },
      { floor, hp: 10, id: "f2-panel-1", kind: "lab-panel", scale: 0.52, x: 13.5, y: 15.5 },
      { dropWeapon: "flamethrower", floor, hp: 14, id: "f2-weapon-box", kind: "box", scale: 0.5, x: size - 8.5, y: 5.5 },
      { floor, hp: 10, id: "f2-panel-2", kind: "lab-panel", scale: 0.5, x: size - 8.5, y: 8.5 },
      { floor, hp: 10, id: "f2-tube-2", kind: "test-tube", scale: 0.66, x: size - 5.5, y: 5.5 },
      { dropHealth: 65, floor, hp: 8, id: "f2-health-barrel", kind: "barrel", scale: 0.38, x: 6.5, y: 17.5 },
      { floor, hp: 10, id: "f2-panel-3", kind: "lab-panel", scale: 0.52, x: size - 8.5, y: size - 8.5 },
      { floor, hp: 10, id: "f2-tube-3", kind: "test-tube", scale: 0.6, x: size - 5.5, y: size - 5.5 },
    ];
  }

  if (floor === 3) {
    return [
      { floor, hp: 12, id: "f3-pipe-1", kind: "pipe", scale: 0.55, x: 5.5, y: 17.5 },
      { floor, hp: 12, id: "f3-grate-1", kind: "sewer-grate", scale: 0.48, x: 13.5, y: 15.5 },
      { floor, hp: 12, id: "f3-pipe-2", kind: "pipe", scale: 0.58, x: size - 9.5, y: 6.5 },
      { floor, hp: 12, id: "f3-grate-2", kind: "sewer-grate", scale: 0.48, x: size - 7.5, y: size - 8.5 },
      { dropHealth: 65, floor, hp: 8, id: "f3-health-barrel", kind: "barrel", scale: 0.38, x: 6.5, y: 16.5 },
      { dropWeapon: "rifle", floor, hp: 14, id: "f3-weapon-box", kind: "box", scale: 0.5, x: 8.5, y: size - 6.5 },
      { floor, hp: 12, id: "f3-pipe-3", kind: "pipe", scale: 0.62, x: 5.5, y: size - 6.5 },
      { floor, hp: 12, id: "f3-grate-3", kind: "sewer-grate", scale: 0.5, x: 12.5, y: size - 4.5 },
    ];
  }

  if (floor === 4) {
    return [
      { floor, hp: 12, id: "f4-growth-1", kind: "growth", scale: 0.55, x: 7.5, y: 23.5 },
      { dropHealth: 65, floor, hp: 8, id: "f4-health-barrel", kind: "barrel", scale: 0.38, x: 10.5, y: 25.5 },
      { floor, hp: 12, id: "f4-cocoon-1", kind: "cocoon", scale: 0.75, x: 14.5, y: 25.5 },
      { floor, hp: 12, id: "f4-growth-2", kind: "growth", scale: 0.58, x: 20.5, y: 8.5 },
      { floor, hp: 12, id: "f4-cocoon-2", kind: "cocoon", scale: 0.78, x: 28.5, y: 10.5 },
      { floor, hp: 12, id: "f4-growth-3", kind: "growth", scale: 0.62, x: 7.5, y: size - 5.5 },
      { dropHealth: 65, floor, hp: 8, id: "f4-health-barrel-2", kind: "barrel", scale: 0.38, x: size - 11.5, y: size - 6.5 },
      { floor, hp: 12, id: "f4-cocoon-3", kind: "cocoon", scale: 0.82, x: size - 6.5, y: size - 9.5 },
      { floor, hp: 12, id: "f4-growth-4", kind: "growth", scale: 0.6, x: size - 9.5, y: size - 5.5 },
    ];
  }

  return [
    { floor, hp: 12, id: "f5-egg-1", kind: "egg", scale: 0.68, x: 7.5, y: 25.5 },
    { dropHealth: 65, floor, hp: 8, id: "f5-health-barrel", kind: "barrel", scale: 0.38, x: 10.5, y: 27.5 },
    { floor, hp: 12, id: "f5-pillar-1", kind: "nest-pillar", scale: 0.95, x: 14.5, y: 28.5 },
    { floor, hp: 12, id: "f5-egg-2", kind: "egg", scale: 0.7, x: 22.5, y: 8.5 },
    { floor, hp: 12, id: "f5-pillar-2", kind: "nest-pillar", scale: 1, x: 28.5, y: 9.5 },
    { floor, hp: 12, id: "f5-egg-3", kind: "egg", scale: 0.72, x: size - 18.5, y: Math.floor(size * 0.5) + 8.5 },
    { dropHealth: 65, floor, hp: 8, id: "f5-health-barrel-2", kind: "barrel", scale: 0.38, x: size - 14.5, y: Math.floor(size * 0.5) + 9.5 },
    { floor, hp: 12, id: "f5-pillar-3", kind: "nest-pillar", scale: 1.05, x: size - 12.5, y: Math.floor(size * 0.5) + 11.5 },
    { floor, hp: 12, id: "f5-egg-4", kind: "egg", scale: 0.75, x: size - 8.5, y: size - 8.5 },
    { floor, hp: 12, id: "f5-pillar-4", kind: "nest-pillar", scale: 1.1, x: size - 4.5, y: size - 7.5 },
  ];
}

export function createInitialPlayer(): Player {
  return {
    dir: { x: 1, y: 0 },
    plane: { x: 0, y: CAMERA_PLANE_LENGTH },
    pos: { ...PLAYER_START },
  };
}

export function createInitialWorld(floor = 1): World {
  const safeFloor = Math.min(Math.max(1, floor), MAX_FLOOR);
  const layout = createStageLayout(safeFloor);

  return {
    decorations: createDecorations(safeFloor, layout.size),
    enemies: createEnemySpawns(safeFloor, layout.size).map((spawn) =>
      createEnemy(spawn.id, spawn.type, spawn.x, spawn.y, safeFloor),
    ),
    exit: { radius: EXIT_RADIUS, ...layout.exit },
    floor: safeFloor,
    healthPickups: createHealthPickups(safeFloor, layout.size),
    impactMarks: [],
    lookV: 0,
    map: layout.map,
    maxFloor: MAX_FLOOR,
    pickups: createWeaponPickups(safeFloor, layout.size),
    player: createInitialPlayer(),
  };
}
