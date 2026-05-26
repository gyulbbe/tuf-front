import { createRng } from "./rng";
import type {
  BossKind,
  DirectionName,
  DungeonDefinition,
  EnemyKind,
  FloorTuning,
  Obstacle,
  RewardKind,
  RoomDefinition,
  RoomExit,
  RoomKind,
  RoomModifier,
} from "./types";

export const ROOM_WIDTH = 960;
export const ROOM_HEIGHT = 600;

const ROOM_MARGIN = 52;
const DOOR_HALF_SIZE = 58;

const DIRECTIONS: Array<{
  dx: number;
  dy: number;
  name: DirectionName;
  opposite: DirectionName;
}> = [
  { dx: 0, dy: -1, name: "north", opposite: "south" },
  { dx: 1, dy: 0, name: "east", opposite: "west" },
  { dx: 0, dy: 1, name: "south", opposite: "north" },
  { dx: -1, dy: 0, name: "west", opposite: "east" },
];

export function createDungeon(seed: string, floor: number): DungeonDefinition {
  const rng = createRng(`${seed}:floor:${floor}:rooms`);
  const tuning = getFloorTuning(floor);
  const roomPositions = createRoomPositions(rng, tuning.roomCount);
  const rooms = roomPositions.map((position, index) =>
    createRoom({
      floor,
      gridX: position.x,
      gridY: position.y,
      index,
      rng,
      tuning,
    }),
  );

  connectRooms(rooms);

  return {
    floor,
    portalRoomId: rooms[rooms.length - 1].id,
    rooms,
    seed,
    startRoomId: rooms[0].id,
    tuning,
  };
}

export function getFloorTuning(floor: number): FloorTuning {
  const depth = Math.max(0, floor - 1);

  return {
    enemyAttackBonus: Math.floor(depth * 1.2),
    enemyHealthBonus: Math.floor(depth * 5),
    roomCount: Math.min(6 + Math.floor(floor * 0.8), 11),
    specialEnemyBudget: Math.min(1 + Math.floor(floor / 2), 5),
  };
}

export function getRoom(dungeon: DungeonDefinition, roomId: string) {
  return dungeon.rooms.find((room) => room.id === roomId) ?? dungeon.rooms[0];
}

export function getExit(room: RoomDefinition, direction: DirectionName) {
  return room.exits.find((exit) => exit.direction === direction) ?? null;
}

export function canUseExit(room: RoomDefinition, clearedRoomIds: string[]) {
  return !["boss", "combat", "elite"].includes(room.kind) || clearedRoomIds.includes(room.id);
}

export function directionFromExitPoint(x: number, y: number): DirectionName | null {
  if (x < ROOM_MARGIN * 0.55 && Math.abs(y - ROOM_HEIGHT / 2) < DOOR_HALF_SIZE) {
    return "west";
  }

  if (
    x > ROOM_WIDTH - ROOM_MARGIN * 0.55 &&
    Math.abs(y - ROOM_HEIGHT / 2) < DOOR_HALF_SIZE
  ) {
    return "east";
  }

  if (y < ROOM_MARGIN * 0.55 && Math.abs(x - ROOM_WIDTH / 2) < DOOR_HALF_SIZE) {
    return "north";
  }

  if (
    y > ROOM_HEIGHT - ROOM_MARGIN * 0.55 &&
    Math.abs(x - ROOM_WIDTH / 2) < DOOR_HALF_SIZE
  ) {
    return "south";
  }

  return null;
}

export function getEntrancePosition(direction: DirectionName) {
  if (direction === "west") {
    return { x: ROOM_WIDTH - ROOM_MARGIN - 18, y: ROOM_HEIGHT / 2 };
  }

  if (direction === "east") {
    return { x: ROOM_MARGIN + 18, y: ROOM_HEIGHT / 2 };
  }

  if (direction === "north") {
    return { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - ROOM_MARGIN - 18 };
  }

  return { x: ROOM_WIDTH / 2, y: ROOM_MARGIN + 18 };
}

export function getDoorCenter(direction: DirectionName) {
  if (direction === "west") {
    return { x: ROOM_MARGIN - 11, y: ROOM_HEIGHT / 2 };
  }

  if (direction === "east") {
    return { x: ROOM_WIDTH - ROOM_MARGIN + 11, y: ROOM_HEIGHT / 2 };
  }

  if (direction === "north") {
    return { x: ROOM_WIDTH / 2, y: ROOM_MARGIN - 11 };
  }

  return { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - ROOM_MARGIN + 11 };
}

export function clampToRoom(value: number, radius: number, axis: "x" | "y") {
  const max = axis === "x" ? ROOM_WIDTH : ROOM_HEIGHT;

  return Math.min(max - ROOM_MARGIN - radius, Math.max(ROOM_MARGIN + radius, value));
}

type CreateRoomOptions = {
  floor: number;
  gridX: number;
  gridY: number;
  index: number;
  rng: ReturnType<typeof createRng>;
  tuning: FloorTuning;
};

function createRoom({
  floor,
  gridX,
  gridY,
  index,
  rng,
  tuning,
}: CreateRoomOptions): RoomDefinition {
  const kind = getRoomKind(index, tuning.roomCount);
  const bossKind = kind === "boss" ? getBossKind(floor, rng) : null;
  const modifier = getRoomModifier({ bossKind, floor, index, kind, rng });
  const reward = getRoomReward(index, kind, floor);

  return {
    bossKind,
    enemyKinds: createEnemyPlan({ floor, index, kind, rng, tuning }),
    exits: [],
    gridX,
    gridY,
    id: `room-${index}`,
    index,
    kind,
    modifier,
    obstacles: createObstacles(rng, index, kind, modifier),
    reward,
  };
}

function createRoomPositions(
  rng: ReturnType<typeof createRng>,
  roomCount: number,
): Array<{ x: number; y: number }> {
  const positions = [{ x: 0, y: 0 }];
  const used = new Set(["0,0"]);
  let cursor = { x: 0, y: 0 };

  for (let attempts = 0; positions.length < roomCount && attempts < 120; attempts += 1) {
    const direction = DIRECTIONS[rng.int(0, DIRECTIONS.length - 1)];
    const next = {
      x: cursor.x + direction.dx,
      y: cursor.y + direction.dy,
    };
    const key = `${next.x},${next.y}`;

    if (!used.has(key)) {
      positions.push(next);
      used.add(key);
      cursor = next;
      continue;
    }

    cursor = positions[rng.int(0, positions.length - 1)];
  }

  while (positions.length < roomCount) {
    const last = positions[positions.length - 1];
    const next = { x: last.x + 1, y: last.y };
    positions.push(next);
    used.add(`${next.x},${next.y}`);
  }

  return positions;
}

function connectRooms(rooms: RoomDefinition[]) {
  rooms.forEach((room) => {
    const exits: RoomExit[] = [];

    rooms.forEach((candidate) => {
      if (room.id === candidate.id) {
        return;
      }

      const dx = candidate.gridX - room.gridX;
      const dy = candidate.gridY - room.gridY;
      const direction = DIRECTIONS.find((entry) => entry.dx === dx && entry.dy === dy);

      if (direction) {
        exits.push({ direction: direction.name, to: candidate.id });
      }
    });

    room.exits = exits;
  });
}

function getRoomKind(index: number, roomCount: number): RoomKind {
  if (index === 0) {
    return "start";
  }

  if (index === roomCount - 1) {
    return "boss";
  }

  if (index % 6 === 4) {
    return "event";
  }

  if (index % 5 === 3) {
    return "elite";
  }

  if (index % 4 === 2) {
    return "treasure";
  }

  return "combat";
}

type GetRoomModifierOptions = {
  bossKind: BossKind | null;
  floor: number;
  index: number;
  kind: RoomKind;
  rng: ReturnType<typeof createRng>;
};

function getRoomModifier({
  bossKind,
  floor,
  index,
  kind,
  rng,
}: GetRoomModifierOptions): RoomModifier {
  if (kind === "start") {
    return "standard";
  }

  if (kind === "event") {
    return floor % 2 === 0 ? "healingWell" : "relicCache";
  }

  if (kind === "treasure") {
    return "relicCache";
  }

  if (kind === "elite") {
    return "eliteBoost";
  }

  if (kind === "boss") {
    if (
      bossKind === "gravityObserver" ||
      bossKind === "deepTuner" ||
      bossKind === "echoSplinterCore"
    ) {
      return "standard";
    }

    return floor >= 6 ? "barrage" : "standard";
  }

  const options: RoomModifier[] = floor >= 3
    ? ["standard", "narrow", "slowField", "barrage"]
    : ["standard", "narrow", "standard"];

  return options[(index + rng.int(0, options.length - 1)) % options.length];
}

function getBossKind(floor: number, rng: ReturnType<typeof createRng>): BossKind {
  if (floor < 3) {
    return "riftGatekeeper";
  }

  if (floor < 6) {
    const midBosses: BossKind[] = [
      "armoredJudicator",
      "echoSplinterCore",
      "gravityObserver",
    ];

    return midBosses[rng.int(0, midBosses.length - 1)];
  }

  if (floor >= 8 && rng.next() < 0.45) {
    return "deepTuner";
  }

  const lateBosses: BossKind[] = [
    "armoredJudicator",
    "echoSplinterCore",
    "gravityObserver",
    "resonanceHierophant",
    "riftGatekeeper",
    "waveCrusher",
  ];

  return lateBosses[rng.int(0, lateBosses.length - 1)];
}

function getRoomReward(index: number, kind: RoomKind, floor: number): RewardKind {
  if (kind === "start") {
    return "none";
  }

  if (kind === "event" || kind === "treasure") {
    return "artifactCache";
  }

  if (kind === "boss") {
    return floor % 2 === 0 ? "artifactCache" : "healingCrystal";
  }

  if (kind === "portal") {
    return floor % 2 === 0 ? "artifactCache" : "bladeResonance";
  }

  if (kind === "elite") {
    return "artifactCache";
  }

  const rewards: RewardKind[] = [
    "shieldCrystal",
    "healingCrystal",
    "bladeResonance",
    "artifactCache",
  ];

  return rewards[index % rewards.length];
}

type CreateEnemyPlanOptions = {
  floor: number;
  index: number;
  kind: RoomKind;
  rng: ReturnType<typeof createRng>;
  tuning: FloorTuning;
};

function createEnemyPlan({
  floor,
  index,
  kind,
  rng,
  tuning,
}: CreateEnemyPlanOptions): EnemyKind[] {
  if (kind === "start" || kind === "treasure" || kind === "event") {
    return [];
  }

  if (kind === "boss") {
    return ["boss"];
  }

  const enemyCount = Math.min(2 + Math.floor((floor + index) / 3) + (kind === "elite" ? 1 : 0), 7);
  const enemies: EnemyKind[] = [];

  for (let enemyIndex = 0; enemyIndex < enemyCount; enemyIndex += 1) {
    enemies.push(pickEnemyKind({ enemyIndex, floor, index, kind, rng, tuning }));
  }

  return enemies;
}

type PickEnemyKindOptions = {
  enemyIndex: number;
  floor: number;
  index: number;
  kind: RoomKind;
  rng: ReturnType<typeof createRng>;
  tuning: FloorTuning;
};

function pickEnemyKind({
  enemyIndex,
  floor,
  index,
  kind,
  rng,
  tuning,
}: PickEnemyKindOptions): EnemyKind {
  if (kind === "elite" && enemyIndex === 0) {
    return floor >= 4 ? "gravityNode" : "guardian";
  }

  const specialPressure = tuning.specialEnemyBudget + Math.floor(index / 2);
  const roll = rng.next() + enemyIndex * 0.025;

  if (floor >= 6 && roll < Math.min(0.13 + specialPressure * 0.025, 0.32)) {
    return "gravityNode";
  }

  if (floor >= 5 && roll < Math.min(0.21 + specialPressure * 0.028, 0.42)) {
    return "riftMine";
  }

  if (floor >= 4 && roll < Math.min(0.29 + specialPressure * 0.03, 0.52)) {
    return "regenerationPriest";
  }

  if (floor >= 3 && roll < Math.min(0.39 + specialPressure * 0.032, 0.62)) {
    return "warpLeaper";
  }

  if (floor >= 2 && roll < Math.min(0.49 + specialPressure * 0.035, 0.72)) {
    return enemyIndex % 2 === 0 ? "resonanceTurret" : "guardian";
  }

  if (roll < 0.45) {
    return "afterimageShard";
  }

  return enemyIndex % 3 === 0 ? "riftApostle" : "stalker";
}

function createObstacles(
  rng: ReturnType<typeof createRng>,
  roomIndex: number,
  kind: RoomDefinition["kind"],
  modifier: RoomModifier,
): Obstacle[] {
  if (kind === "start") {
    return [];
  }

  const count = modifier === "narrow"
    ? 5
    : kind === "treasure" || kind === "event"
      ? 1
      : 2 + (roomIndex % 2);
  const obstacles: Obstacle[] = [];

  for (let index = 0; index < count; index += 1) {
    const w = rng.int(72, 128);
    const h = rng.int(42, 84);
    const x = rng.int(ROOM_MARGIN + 90, ROOM_WIDTH - ROOM_MARGIN - 90 - w);
    const y = rng.int(ROOM_MARGIN + 74, ROOM_HEIGHT - ROOM_MARGIN - 74 - h);

    if (Math.abs(x + w / 2 - ROOM_WIDTH / 2) < 120 && Math.abs(y + h / 2 - ROOM_HEIGHT / 2) < 90) {
      continue;
    }

    obstacles.push({
      h,
      id: `obstacle-${roomIndex}-${index}`,
      w,
      x,
      y,
    });
  }

  return obstacles;
}
