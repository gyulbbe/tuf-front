"use client";

/* eslint-disable react-hooks/immutability */

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";
import { gameAssetUrl } from "@/lib/game-assets-url";
import { cn } from "@/lib/utils";

export type PinballPlayer = DraftUserSearchResult & {
  teamIndex: number;
  teamLabel: string;
};

export type PinballFinishEntry = {
  candidate: PinballPlayer;
  elapsedMs: number;
  rank: number;
};

export type PinballLiveRankEntry = {
  candidate: PinballPlayer;
  elapsedMs: number | null;
  isFinished: boolean;
  rank: number;
};

type PinballBoardProps = {
  candidates: PinballPlayer[];
  className?: string;
  followCandidateId: number | null;
  isRunning: boolean;
  onFinishOrder: (order: PinballFinishEntry[]) => void;
  onFollowCandidateFinished?: (candidateId: number) => void;
  onLiveRankingChange?: (ranking: PinballLiveRankEntry[]) => void;
  onManualCamera?: () => void;
  onProgressOrder?: (order: PinballFinishEntry[]) => void;
  onSelectCandidate?: (candidateId: number | null) => void;
  runId: number;
  shuffleSeed: number;
};

type BallState = {
  candidate: PinballPlayer;
  color: string;
  finishElapsedMs: number | null;
  idleSeconds: number;
  radius: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type Segment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  tone?: "wall" | "guard" | "gate";
};

type BlockerRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type TiltBar = {
  angle: number;
  angularVelocity: number;
  baseAngle: number;
  length: number;
  x: number;
  y: number;
};

type Bumper = {
  bounceMultiplier?: number;
  x: number;
  y: number;
  radius: number;
  kind: "round" | "half-left" | "half-right";
};

type DragState = {
  moved: boolean;
  pointerId: number;
  startCameraY: number;
  startClientX: number;
  startClientY: number;
};

type OrderedCandidate = {
  candidate: PinballPlayer;
  originalIndex: number;
};

type ObstacleVisualState = "closed" | "opening" | "open" | "firing" | "closing";

type ObstacleKind = "trap" | "missile" | "fire";

type ObstacleId = "trap" | "missile" | "fireLeft" | "fireRight";

type PinballTrapAssetKey =
  | "trap1"
  | "trap2"
  | "trap3"
  | "trap4"
  | "trap5"
  | "trap6"
  | "trap7"
  | "missile1"
  | "missile2"
  | "missile3"
  | "missile4"
  | "missile5"
  | "missile6"
  | "fire1"
  | "fire2"
  | "fire3"
  | "fire4"
  | "fire5"
  | "fire6";

type PinballTrapAssets = Partial<Record<PinballTrapAssetKey, HTMLImageElement | null>>;

type ObstacleState = {
  angle: number;
  cooldownSeconds: number;
  drawSize: number;
  firingSeconds: number;
  halfWidth: number;
  id: ObstacleId;
  kind: ObstacleKind;
  phase: ObstacleVisualState;
  phaseElapsedSeconds: number;
  range: number;
  targetCandidateId: number | null;
  x: number;
  y: number;
};

type ObstacleHitEffect = {
  elapsedSeconds: number;
  kind: ObstacleKind;
  x: number;
  y: number;
};

type MissileShotEffect = {
  elapsedSeconds: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 2200;
const FINISH_Y = 2040;
const BALL_RADIUS = 13;
const GOAL_BAR_CENTER = { x: WORLD_WIDTH / 2, y: 1690 };
const GOAL_BAR_LENGTH = 340;
const GOAL_BAR_SPEED = 2.35;
const COLORS = [
  "#e65d3f",
  "#1f8f7a",
  "#d39b2f",
  "#476fbd",
  "#b65aa0",
  "#5b8d3e",
  "#d66f2f",
  "#2f9fb0",
  "#8a6fd1",
  "#4f7d58",
];
const PINBALL_TRAP_ASSET_KEYS: PinballTrapAssetKey[] = [
  "trap1",
  "trap2",
  "trap3",
  "trap4",
  "trap5",
  "trap6",
  "trap7",
  "missile1",
  "missile2",
  "missile3",
  "missile4",
  "missile5",
  "missile6",
  "fire1",
  "fire2",
  "fire3",
  "fire4",
  "fire5",
  "fire6",
];
const TRAP_RANGE = 300;
const TRAP_DRAW_SIZE = 150;
const MISSILE_RANGE = 300;
const MISSILE_DRAW_SIZE = 136;
const FIRE_RANGE = 190;
const FIRE_DRAW_SIZE = 132;
const TRAP_HIT_EFFECT_SIZE = 92;
const MISSILE_HIT_EFFECT_SIZE = 112;
const FIRE_HIT_EFFECT_SIZE = 112;
const TRAP_FIRE_COOLDOWN_SECONDS = 2.1;
const TRAP_PUSH_FORCE = 380;
const MISSILE_FIRE_COOLDOWN_SECONDS = 1.85;
const MISSILE_PUSH_FORCE = 410;
const FIRE_FIRE_COOLDOWN_SECONDS = 2;
const FIRE_PUSH_FORCE = 340;
const MISSILE_TRAP_OFFSET_X = 240;
const OBSTACLE_OPEN_SECONDS = 0.24;
const OBSTACLE_CLOSE_SECONDS = 0.2;
const OBSTACLE_FIRE_SECONDS = 0.1;
const OBSTACLE_FIRST_SHOT_DELAY_SECONDS = 0.14;
const TRAP_TARGET_MIN_ABOVE = 36;
const TRAP_TARGET_HALF_WIDTH = 115;
const MISSILE_TARGET_HALF_WIDTH = 120;
const FIRE_TARGET_LOWER_MARGIN = 12;
const TRAP_HIT_EFFECT_SECONDS = 0.34;
const MISSILE_SHOT_EFFECT_SECONDS = 0.22;
const GOAL_SIDE_BLOCKER_TOP = FINISH_Y - 78;
const GOAL_SIDE_BLOCKER_BOTTOM = FINISH_Y + 150;

const STATIC_SEGMENTS: Segment[] = [
  { ax: 34, ay: 0, bx: 34, by: WORLD_HEIGHT, tone: "wall" },
  { ax: WORLD_WIDTH - 34, ay: 0, bx: WORLD_WIDTH - 34, by: WORLD_HEIGHT, tone: "wall" },
  { ax: 34, ay: 1790, bx: 350, by: 1980, tone: "gate" },
  { ax: WORLD_WIDTH - 34, ay: 1790, bx: 550, by: 1980, tone: "gate" },
];

const TILT_BAR_DEFINITIONS = [
  { ax: 80, ay: 260, bx: 270, by: 380 },
  { ax: 820, ay: 260, bx: 630, by: 380 },
  { ax: 120, ay: 620, bx: 330, by: 740 },
  { ax: 780, ay: 620, bx: 570, by: 740 },
  { ax: 90, ay: 1000, bx: 280, by: 1130 },
  { ax: 810, ay: 1000, bx: 620, by: 1130 },
];

const BUMPERS: Bumper[] = [
  { x: 450, y: 510, radius: 62, kind: "round" },
  { x: 230, y: 850, radius: 54, kind: "half-right" },
  { x: 670, y: 850, radius: 54, kind: "half-left" },
  { x: 450, y: 1210, radius: 70, kind: "round" },
  { x: 250, y: 1470, radius: 58, kind: "half-right" },
  { x: 650, y: 1470, radius: 58, kind: "half-left" },
];

function buildPins() {
  const pins: Array<{ x: number; y: number; radius: number }> = [];

  for (let row = 0; row < 12; row += 1) {
    const y = 220 + row * 115;
    const isUpperRow = row < 4;
    const spacing = isUpperRow ? 120 : 100;
    const baseX = isUpperRow ? 150 : 135;
    const endX = isUpperRow ? 750 : 765;
    const offset = row % 2 === 0 ? 0 : spacing / 2;

    for (let x = baseX + offset; x <= endX; x += spacing) {
      const nearLargeBumper = BUMPERS.some((bumper) => {
        const clearance = bumper.kind === "round" ? 130 : 120;

        return Math.hypot(x - bumper.x, y - bumper.y) < bumper.radius + clearance;
      });

      if (nearLargeBumper) {
        continue;
      }

      pins.push({ x, y, radius: 8 });
    }
  }

  return pins;
}

const PINS = buildPins();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pickColor(index: number) {
  return COLORS[index % COLORS.length];
}

function createTiltBars(): TiltBar[] {
  return TILT_BAR_DEFINITIONS.map((definition) => {
    const dx = definition.bx - definition.ax;
    const dy = definition.by - definition.ay;
    const angle = Math.atan2(dy, dx);

    return {
      angle,
      angularVelocity: 0,
      baseAngle: angle,
      length: Math.hypot(dx, dy),
      x: (definition.ax + definition.bx) / 2,
      y: (definition.ay + definition.by) / 2,
    };
  });
}

function tiltBarToSegment(bar: TiltBar): Segment {
  const halfLength = bar.length / 2;
  const dx = Math.cos(bar.angle) * halfLength;
  const dy = Math.sin(bar.angle) * halfLength;

  return {
    ax: bar.x - dx,
    ay: bar.y - dy,
    bx: bar.x + dx,
    by: bar.y + dy,
    tone: "guard",
  };
}

function getGateOpening(timeSeconds: number) {
  return 80 + (Math.sin(timeSeconds * 1.7) + 1) * 80;
}

function buildGateSegments(opening: number): Segment[] {
  const leftEdge = WORLD_WIDTH / 2 - opening / 2;
  const rightEdge = WORLD_WIDTH / 2 + opening / 2;

  return [
    { ax: 34, ay: FINISH_Y, bx: leftEdge, by: FINISH_Y, tone: "gate" },
    { ax: rightEdge, ay: FINISH_Y, bx: WORLD_WIDTH - 34, by: FINISH_Y, tone: "gate" },
    { ax: leftEdge, ay: FINISH_Y, bx: leftEdge - 70, by: FINISH_Y - 95, tone: "gate" },
    { ax: rightEdge, ay: FINISH_Y, bx: rightEdge + 70, by: FINISH_Y - 95, tone: "gate" },
  ];
}

function buildGoalSideBlockers(opening: number): BlockerRect[] {
  const leftEdge = WORLD_WIDTH / 2 - opening / 2;
  const rightEdge = WORLD_WIDTH / 2 + opening / 2;
  const height = GOAL_SIDE_BLOCKER_BOTTOM - GOAL_SIDE_BLOCKER_TOP;

  return [
    {
      height,
      width: Math.max(0, leftEdge - 34),
      x: 34,
      y: GOAL_SIDE_BLOCKER_TOP,
    },
    {
      height,
      width: Math.max(0, WORLD_WIDTH - 34 - rightEdge),
      x: rightEdge,
      y: GOAL_SIDE_BLOCKER_TOP,
    },
  ];
}

function hashSeed(seed: number) {
  let value = (seed + 0x9e3779b9) >>> 0;

  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function createSeededRandom(seed: number) {
  let value = hashSeed(seed) || 1;

  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;

    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function getPinballTrapAssetUrl(imageKey: PinballTrapAssetKey) {
  return gameAssetUrl(`pinball/${imageKey}.png`);
}

function createObstacleState(
  entry: Omit<
    ObstacleState,
    | "angle"
    | "cooldownSeconds"
    | "firingSeconds"
    | "phase"
    | "phaseElapsedSeconds"
    | "targetCandidateId"
  >,
): ObstacleState {
  return {
    ...entry,
    angle: -Math.PI / 2,
    cooldownSeconds: OBSTACLE_FIRST_SHOT_DELAY_SECONDS,
    firingSeconds: 0,
    phase: "closed",
    phaseElapsedSeconds: 0,
    targetCandidateId: null,
  };
}

function createObstacleStates(
  runId: number,
  shuffleSeed: number,
  candidateCount: number,
): ObstacleState[] {
  const random = createSeededRandom(
    runId * 1009 + shuffleSeed * 9176 + candidateCount * 37 + 0x516d,
  );
  const trapX = WORLD_WIDTH / 2 - 72 + random() * 144;
  const trapY = FINISH_Y - 120 - random() * 90;
  const jitter = () => random() * 20 - 10;

  return [
    createObstacleState({
      drawSize: TRAP_DRAW_SIZE,
      halfWidth: TRAP_TARGET_HALF_WIDTH,
      id: "trap",
      kind: "trap",
      range: TRAP_RANGE,
      x: trapX,
      y: trapY,
    }),
    createObstacleState({
      drawSize: MISSILE_DRAW_SIZE,
      halfWidth: MISSILE_TARGET_HALF_WIDTH,
      id: "missile",
      kind: "missile",
      range: MISSILE_RANGE,
      x: clamp(trapX + MISSILE_TRAP_OFFSET_X, 560, WORLD_WIDTH - 100),
      y: trapY + jitter(),
    }),
    createObstacleState({
      drawSize: FIRE_DRAW_SIZE,
      halfWidth: FIRE_RANGE,
      id: "fireLeft",
      kind: "fire",
      range: FIRE_RANGE,
      x: WORLD_WIDTH / 2 - 170 + jitter(),
      y: FINISH_Y - 145 + jitter(),
    }),
    createObstacleState({
      drawSize: FIRE_DRAW_SIZE,
      halfWidth: FIRE_RANGE,
      id: "fireRight",
      kind: "fire",
      range: FIRE_RANGE,
      x: WORLD_WIDTH / 2 + 170 + jitter(),
      y: FINISH_Y - 145 + jitter(),
    }),
  ];
}

function getObstacleCooldownSeconds(kind: ObstacleKind) {
  if (kind === "missile") {
    return MISSILE_FIRE_COOLDOWN_SECONDS;
  }

  if (kind === "fire") {
    return FIRE_FIRE_COOLDOWN_SECONDS;
  }

  return TRAP_FIRE_COOLDOWN_SECONDS;
}

function getObstaclePushForce(kind: ObstacleKind) {
  if (kind === "missile") {
    return MISSILE_PUSH_FORCE;
  }

  if (kind === "fire") {
    return FIRE_PUSH_FORCE;
  }

  return TRAP_PUSH_FORCE;
}

function getHitEffectSize(kind: ObstacleKind) {
  if (kind === "missile") {
    return MISSILE_HIT_EFFECT_SIZE;
  }

  if (kind === "fire") {
    return FIRE_HIT_EFFECT_SIZE;
  }

  return TRAP_HIT_EFFECT_SIZE;
}

function getHitEffectAssetKey(kind: ObstacleKind): PinballTrapAssetKey {
  if (kind === "missile") {
    return "missile6";
  }

  if (kind === "fire") {
    return "fire6";
  }

  return "trap7";
}

function getObstacleFrameKey(obstacle: ObstacleState): PinballTrapAssetKey {
  if (obstacle.kind === "trap") {
    if (obstacle.firingSeconds > 0 || obstacle.phase === "firing") {
      return "trap6";
    }

    if (obstacle.phase === "opening") {
      const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_OPEN_SECONDS, 0, 0.999);
      const frames: PinballTrapAssetKey[] = ["trap2", "trap3", "trap4", "trap5"];

      return frames[Math.floor(progress * frames.length)];
    }

    if (obstacle.phase === "open") {
      return "trap5";
    }

    if (obstacle.phase === "closing") {
      const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_CLOSE_SECONDS, 0, 0.999);
      const frames: PinballTrapAssetKey[] = ["trap4", "trap3", "trap2", "trap1"];

      return frames[Math.floor(progress * frames.length)];
    }

    return "trap1";
  }

  if (obstacle.kind === "missile") {
    if (obstacle.phase === "opening") {
      const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_OPEN_SECONDS, 0, 0.999);
      const frames: PinballTrapAssetKey[] = ["missile1", "missile2", "missile3", "missile4"];

      return frames[Math.floor(progress * frames.length)];
    }

    if (obstacle.phase === "open" || obstacle.phase === "firing") {
      return "missile4";
    }

    if (obstacle.phase === "closing") {
      const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_CLOSE_SECONDS, 0, 0.999);
      const frames: PinballTrapAssetKey[] = ["missile4", "missile3", "missile2", "missile1"];

      return frames[Math.floor(progress * frames.length)];
    }

    return "missile1";
  }

  if (obstacle.phase === "firing") {
    return "fire5";
  }

  if (obstacle.phase === "opening") {
    const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_OPEN_SECONDS, 0, 0.999);
    const frames: PinballTrapAssetKey[] = ["fire1", "fire2", "fire3", "fire4"];

    return frames[Math.floor(progress * frames.length)];
  }

  if (obstacle.phase === "open") {
    return "fire4";
  }

  if (obstacle.phase === "closing") {
    const progress = clamp(obstacle.phaseElapsedSeconds / OBSTACLE_CLOSE_SECONDS, 0, 0.999);
    const frames: PinballTrapAssetKey[] = ["fire4", "fire3", "fire2", "fire1"];

    return frames[Math.floor(progress * frames.length)];
  }

  return "fire1";
}

function hasSameCandidateSet(
  candidates: readonly PinballPlayer[],
  previousOrderIds: readonly number[] | null,
) {
  if (!previousOrderIds || previousOrderIds.length !== candidates.length) {
    return false;
  }

  const currentIds = new Set(candidates.map((candidate) => candidate.id));

  return previousOrderIds.every((candidateId) => currentIds.has(candidateId));
}

function orderCandidatesByIds(
  candidates: readonly PinballPlayer[],
  orderIds: readonly number[],
) {
  const indexedCandidates = new Map(
    candidates.map((candidate, originalIndex) => [
      candidate.id,
      { candidate, originalIndex },
    ]),
  );

  return orderIds.flatMap((candidateId) => {
    const entry = indexedCandidates.get(candidateId);

    return entry ? [entry] : [];
  });
}

function hasFixedSlot(
  order: readonly OrderedCandidate[],
  previousOrderIds: readonly number[],
) {
  return order.some(
    (entry, index) => entry.candidate.id === previousOrderIds[index],
  );
}

function rotateOrder(order: readonly OrderedCandidate[], offset: number) {
  return order.map((_, index) => order[(index + offset) % order.length]);
}

function removeFixedSlots(
  order: OrderedCandidate[],
  previousOrderIds: readonly number[],
  random: () => number,
) {
  const nextOrder = [...order];

  for (let index = 0; index < nextOrder.length; index += 1) {
    if (nextOrder[index].candidate.id !== previousOrderIds[index]) {
      continue;
    }

    const startOffset = Math.floor(random() * (nextOrder.length - 1)) + 1;

    for (let checked = 0; checked < nextOrder.length - 1; checked += 1) {
      const swapIndex = (index + startOffset + checked) % nextOrder.length;

      if (
        swapIndex === index ||
        nextOrder[swapIndex].candidate.id === previousOrderIds[index] ||
        nextOrder[index].candidate.id === previousOrderIds[swapIndex]
      ) {
        continue;
      }

      const current = nextOrder[index];
      nextOrder[index] = nextOrder[swapIndex];
      nextOrder[swapIndex] = current;
      break;
    }
  }

  if (!hasFixedSlot(nextOrder, previousOrderIds)) {
    return nextOrder;
  }

  for (let offset = 1; offset < nextOrder.length; offset += 1) {
    const rotatedOrder = rotateOrder(nextOrder, offset);

    if (!hasFixedSlot(rotatedOrder, previousOrderIds)) {
      return rotatedOrder;
    }
  }

  return nextOrder;
}

function shuffleCandidateOrder(
  candidates: PinballPlayer[],
  shuffleSeed: number,
  previousOrderIds: readonly number[] | null,
) {
  const orderedCandidates = candidates.map((candidate, originalIndex) => ({
    candidate,
    originalIndex,
  }));

  if (shuffleSeed <= 0 || orderedCandidates.length <= 1) {
    return orderedCandidates;
  }

  const random = createSeededRandom(shuffleSeed);

  for (let index = orderedCandidates.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    const current = orderedCandidates[index];
    orderedCandidates[index] = orderedCandidates[nextIndex];
    orderedCandidates[nextIndex] = current;
  }

  if (
    previousOrderIds !== null &&
    hasSameCandidateSet(candidates, previousOrderIds)
  ) {
    return removeFixedSlots(orderedCandidates, previousOrderIds, random);
  }

  return orderedCandidates;
}

function createBalls(
  candidates: PinballPlayer[],
  shuffleSeed: number,
  previousOrderIds: readonly number[] | null,
  shouldShuffleAgainstPreviousOrder: boolean,
) {
  const orderedCandidates =
    !shouldShuffleAgainstPreviousOrder &&
    previousOrderIds !== null &&
    hasSameCandidateSet(candidates, previousOrderIds)
      ? orderCandidatesByIds(candidates, previousOrderIds)
      : shuffleCandidateOrder(
          candidates,
          shuffleSeed,
          shouldShuffleAgainstPreviousOrder ? previousOrderIds : null,
        );
  const gap = Math.min(72, (WORLD_WIDTH - 180) / Math.max(candidates.length, 1));
  const startX = WORLD_WIDTH / 2 - ((candidates.length - 1) * gap) / 2;

  return {
    balls: orderedCandidates.map(({ candidate, originalIndex }, index) => ({
      candidate,
      color: pickColor(originalIndex),
      finishElapsedMs: null,
      idleSeconds: 0,
      radius: BALL_RADIUS,
      vx: (index % 2 === 0 ? 1 : -1) * (35 + index * 7),
      vy: 0,
      x: clamp(startX + index * gap, 70, WORLD_WIDTH - 70),
      y: 70 + (index % 3) * 14,
    })),
    orderIds: orderedCandidates.map((entry) => entry.candidate.id),
  };
}

function collideCircle(
  ball: BallState,
  cx: number,
  cy: number,
  radius: number,
  bounceMultiplier = 1,
) {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const distance = Math.hypot(dx, dy);
  const minDistance = ball.radius + radius;

  if (distance <= 0 || distance >= minDistance) {
    return false;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  if (velocityAlongNormal < 0) {
    ball.vx -= (1.38 * bounceMultiplier * velocityAlongNormal) * nx;
    ball.vy -= (1.38 * bounceMultiplier * velocityAlongNormal) * ny;
  }

  ball.vx += nx * 18 * bounceMultiplier;
  ball.vy += ny * 18 * bounceMultiplier;
  return true;
}

function collideSegment(
  ball: BallState,
  segment: Segment,
  restitution = 0.48,
  tangentBoost = 0,
) {
  const sx = segment.bx - segment.ax;
  const sy = segment.by - segment.ay;
  const lengthSq = sx * sx + sy * sy;

  if (lengthSq <= 0) {
    return false;
  }

  const t = clamp(
    ((ball.x - segment.ax) * sx + (ball.y - segment.ay) * sy) / lengthSq,
    0,
    1,
  );
  const nearestX = segment.ax + sx * t;
  const nearestY = segment.ay + sy * t;
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0 || distance >= ball.radius + 7) {
    return false;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = ball.radius + 7 - distance;
  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  if (velocityAlongNormal < 0) {
    ball.vx -= ((1 + restitution) * velocityAlongNormal) * nx;
    ball.vy -= ((1 + restitution) * velocityAlongNormal) * ny;
  }

  if (tangentBoost !== 0) {
    const tangentX = -ny;
    const tangentY = nx;
    ball.vx += tangentX * tangentBoost;
    ball.vy += tangentY * tangentBoost;
  }

  return true;
}

function collideRect(ball: BallState, rect: BlockerRect, restitution = 0.42) {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
  let dx = ball.x - nearestX;
  let dy = ball.y - nearestY;
  let distance = Math.hypot(dx, dy);
  let nx = distance > 0 ? dx / distance : 0;
  let ny = distance > 0 ? dy / distance : 0;
  let overlap = ball.radius - distance;

  if (distance === 0) {
    const left = ball.x - rect.x;
    const right = rect.x + rect.width - ball.x;
    const top = ball.y - rect.y;
    const bottom = rect.y + rect.height - ball.y;
    const minDistance = Math.min(left, right, top, bottom);

    if (minDistance === left) {
      nx = -1;
      ny = 0;
      overlap = left + ball.radius;
    } else if (minDistance === right) {
      nx = 1;
      ny = 0;
      overlap = right + ball.radius;
    } else if (minDistance === top) {
      nx = 0;
      ny = -1;
      overlap = top + ball.radius;
    } else {
      nx = 0;
      ny = 1;
      overlap = bottom + ball.radius;
    }
  }

  if (overlap <= 0) {
    return false;
  }

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;

  if (velocityAlongNormal < 0) {
    ball.vx -= ((1 + restitution) * velocityAlongNormal) * nx;
    ball.vy -= ((1 + restitution) * velocityAlongNormal) * ny;
  }

  return true;
}

function collideGoalSideBlockers(ball: BallState, opening: number) {
  let collided = false;

  for (const blocker of buildGoalSideBlockers(opening)) {
    collided = collideRect(ball, blocker, 0.36) || collided;
  }

  if (collided) {
    ball.vx += ball.x < WORLD_WIDTH / 2 ? 92 : -92;
    ball.vy -= 26;
  }

  return collided;
}

function collideTiltBar(ball: BallState, bar: TiltBar) {
  const segment = tiltBarToSegment(bar);
  const sx = segment.bx - segment.ax;
  const sy = segment.by - segment.ay;
  const lengthSq = sx * sx + sy * sy;

  if (lengthSq <= 0) {
    return false;
  }

  const t = clamp(
    ((ball.x - segment.ax) * sx + (ball.y - segment.ay) * sy) / lengthSq,
    0,
    1,
  );
  const nearestX = segment.ax + sx * t;
  const nearestY = segment.ay + sy * t;
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0 || distance >= ball.radius + 8) {
    return false;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = ball.radius + 8 - distance;
  const velocityAlongNormal = ball.vx * nx + ball.vy * ny;

  ball.x += nx * overlap;
  ball.y += ny * overlap;

  if (velocityAlongNormal < 0) {
    ball.vx -= (1.36 * velocityAlongNormal) * nx;
    ball.vy -= (1.36 * velocityAlongNormal) * ny;
  }

  const rx = nearestX - bar.x;
  const ry = nearestY - bar.y;
  const torqueDirection = rx * ny - ry * nx || (t < 0.5 ? -1 : 1);
  const impact = Math.max(60, Math.abs(velocityAlongNormal) + Math.hypot(ball.vx, ball.vy) * 0.14);

  bar.angularVelocity += clamp(torqueDirection * impact * 0.0028, -5.8, 5.8);
  ball.vx += nx * 14;
  ball.vy += ny * 14;
  return true;
}

function drawSegment(ctx: CanvasRenderingContext2D, segment: Segment) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = segment.tone === "wall" ? 18 : segment.tone === "gate" ? 16 : 12;
  ctx.strokeStyle =
    segment.tone === "wall"
      ? "#274152"
      : segment.tone === "gate"
        ? "#d36f3b"
        : "#1f8f7a";
  ctx.shadowColor = "rgba(23, 33, 43, 0.18)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(segment.ax, segment.ay);
  ctx.lineTo(segment.bx, segment.by);
  ctx.stroke();
  ctx.restore();
}

function drawTiltBar(ctx: CanvasRenderingContext2D, bar: TiltBar) {
  const segment = tiltBarToSegment(bar);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 24;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.moveTo(segment.ax, segment.ay);
  ctx.lineTo(segment.bx, segment.by);
  ctx.stroke();

  ctx.lineWidth = 14;
  ctx.strokeStyle = "#1f8f7a";
  ctx.shadowColor = "rgba(31,143,122,0.35)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(segment.ax, segment.ay);
  ctx.lineTo(segment.bx, segment.by);
  ctx.stroke();
  ctx.restore();
}

function drawBumper(ctx: CanvasRenderingContext2D, bumper: Bumper) {
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#274152";
  ctx.fillStyle = "#fff4d2";
  ctx.shadowColor = "rgba(23, 33, 43, 0.16)";
  ctx.shadowBlur = 18;

  if (bumper.kind === "round") {
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const start = bumper.kind === "half-left" ? Math.PI / 2 : -Math.PI / 2;
    const end = bumper.kind === "half-left" ? Math.PI * 1.5 : Math.PI / 2;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.radius, start, end);
    ctx.lineTo(bumper.x, bumper.y + bumper.radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "#d36f3b";
  ctx.beginPath();
  ctx.arc(bumper.x, bumper.y, Math.max(12, bumper.radius * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGoalSideBlockers(ctx: CanvasRenderingContext2D, opening: number) {
  ctx.save();

  for (const blocker of buildGoalSideBlockers(opening)) {
    if (blocker.width <= 0 || blocker.height <= 0) {
      continue;
    }

    ctx.fillStyle = "rgba(241, 215, 167, 0.88)";
    ctx.fillRect(blocker.x, blocker.y, blocker.width, blocker.height);
    ctx.strokeStyle = "rgba(211, 111, 59, 0.16)";
    ctx.lineWidth = 3;
    ctx.strokeRect(blocker.x, blocker.y, blocker.width, blocker.height);
  }

  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: ObstacleState,
  assets: PinballTrapAssets,
) {
  const image = assets[getObstacleFrameKey(obstacle)];

  if (!image) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = obstacle.phase === "closed" ? 0.88 : 1;
  ctx.shadowColor = "rgba(23, 33, 43, 0.24)";
  ctx.shadowBlur = 18;
  ctx.drawImage(
    image,
    obstacle.x - obstacle.drawSize / 2,
    obstacle.y - obstacle.drawSize / 2,
    obstacle.drawSize,
    obstacle.drawSize,
  );
  ctx.restore();
}

function drawMissileShotEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly MissileShotEffect[],
  assets: PinballTrapAssets,
) {
  const image = assets.missile5;

  if (!image) {
    return;
  }

  for (const effect of effects) {
    const progress = clamp(effect.elapsedSeconds / MISSILE_SHOT_EFFECT_SECONDS, 0, 1);
    const x = effect.fromX + (effect.toX - effect.fromX) * progress;
    const y = effect.fromY + (effect.toY - effect.fromY) * progress;
    const angle = Math.atan2(effect.toY - effect.fromY, effect.toX - effect.fromX);
    const size = 70;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI);
    ctx.globalAlpha = 1 - progress * 0.25;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

function drawObstacleHitEffects(
  ctx: CanvasRenderingContext2D,
  effects: readonly ObstacleHitEffect[],
  assets: PinballTrapAssets,
) {
  for (const effect of effects) {
    const image = assets[getHitEffectAssetKey(effect.kind)];

    if (!image) {
      continue;
    }

    const progress = clamp(effect.elapsedSeconds / TRAP_HIT_EFFECT_SECONDS, 0, 1);
    const size = getHitEffectSize(effect.kind) * (0.82 + progress * 0.42);

    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.drawImage(
      image,
      effect.x - size / 2,
      effect.y - size / 2,
      size,
      size,
    );
    ctx.restore();
  }
}

export function PinballBoard({
  candidates,
  className,
  followCandidateId,
  isRunning,
  onFinishOrder,
  onFollowCandidateFinished,
  onLiveRankingChange,
  onManualCamera,
  onProgressOrder,
  onSelectCandidate,
  runId,
  shuffleSeed,
}: PinballBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLParagraphElement | null>(null);
  const ballsRef = useRef<BallState[]>([]);
  const tiltBarsRef = useRef<TiltBar[]>([]);
  const obstaclesRef = useRef<ObstacleState[]>([]);
  const trapAssetsRef = useRef<PinballTrapAssets>({});
  const obstacleHitEffectsRef = useRef<ObstacleHitEffect[]>([]);
  const missileShotEffectsRef = useRef<MissileShotEffect[]>([]);
  const finishOrderRef = useRef<PinballFinishEntry[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const lastShuffleSeedRef = useRef(shuffleSeed);
  const previousOrderIdsRef = useRef<number[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const cameraYRef = useRef(0);
  const autoCameraRef = useRef(true);
  const dragRef = useRef<DragState | null>(null);
  const sizeRef = useRef({ width: 900, height: 620 });
  const finishCallbackRef = useRef(onFinishOrder);
  const isRunningRef = useRef(isRunning);
  const followCandidateFinishedCallbackRef = useRef(onFollowCandidateFinished);
  const manualCameraCallbackRef = useRef(onManualCamera);
  const progressCallbackRef = useRef(onProgressOrder);
  const liveRankingCallbackRef = useRef(onLiveRankingChange);
  const lastLiveRankingSignatureRef = useRef("");
  const lastLiveRankingEmitMsRef = useRef(0);
  const followCandidateIdRef = useRef(followCandidateId);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 760 });

  useEffect(() => {
    finishCallbackRef.current = onFinishOrder;
  }, [onFinishOrder]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    followCandidateFinishedCallbackRef.current = onFollowCandidateFinished;
  }, [onFollowCandidateFinished]);

  useEffect(() => {
    manualCameraCallbackRef.current = onManualCamera;
  }, [onManualCamera]);

  useEffect(() => {
    progressCallbackRef.current = onProgressOrder;
  }, [onProgressOrder]);

  useEffect(() => {
    liveRankingCallbackRef.current = onLiveRankingChange;
  }, [onLiveRankingChange]);

  useEffect(() => {
    followCandidateIdRef.current = followCandidateId;
    if (typeof followCandidateId === "number") {
      autoCameraRef.current = true;
    }
  }, [followCandidateId]);

  useEffect(() => {
    let isActive = true;

    for (const imageKey of PINBALL_TRAP_ASSET_KEYS) {
      const image = new Image();

      image.onload = () => {
        if (!isActive) {
          return;
        }

        trapAssetsRef.current = { ...trapAssetsRef.current, [imageKey]: image };
      };
      image.onerror = () => {
        if (!isActive) {
          return;
        }

        trapAssetsRef.current = { ...trapAssetsRef.current, [imageKey]: null };
      };
      image.src = getPinballTrapAssetUrl(imageKey);
    }

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return;
    }

    const resize = () => {
      const width = Math.max(wrapper.clientWidth, 320);
      const scale = width / WORLD_WIDTH;
      const baseHeight = clamp(width * 0.8, 560, 880);
      const wrapperStyle = window.getComputedStyle(wrapper);
      const footer = footerRef.current;
      const footerStyle = footer ? window.getComputedStyle(footer) : null;
      const paddingHeight =
        Number.parseFloat(wrapperStyle.paddingTop || "0") +
        Number.parseFloat(wrapperStyle.paddingBottom || "0");
      const footerHeight = footer
        ? footer.getBoundingClientRect().height +
          Number.parseFloat(footerStyle?.marginTop || "0") +
          Number.parseFloat(footerStyle?.marginBottom || "0")
        : 0;
      const stretchedHeight =
        wrapper.clientHeight > 0
          ? Math.max(0, wrapper.clientHeight - paddingHeight - footerHeight)
          : 0;
      const height = clamp(
        Math.max(baseHeight, stretchedHeight),
        560,
        Math.max(880, WORLD_HEIGHT * scale),
      );
      const nextSize = { width, height };

      sizeRef.current = nextSize;
      setCanvasSize(nextSize);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const shouldCompareWithPreviousOrder =
      shuffleSeed > 0 && shuffleSeed !== lastShuffleSeedRef.current;
    const nextLayout = createBalls(
      candidates,
      shuffleSeed,
      previousOrderIdsRef.current,
      shouldCompareWithPreviousOrder,
    );

    ballsRef.current = nextLayout.balls;
    previousOrderIdsRef.current = nextLayout.orderIds;
    lastShuffleSeedRef.current = shuffleSeed;
    tiltBarsRef.current = createTiltBars();
    obstaclesRef.current = createObstacleStates(runId, shuffleSeed, candidates.length);
    obstacleHitEffectsRef.current = [];
    missileShotEffectsRef.current = [];
    finishOrderRef.current = [];
    cameraYRef.current = 0;
    autoCameraRef.current = true;
    lastFrameRef.current = null;
    startedAtRef.current = null;
    lastLiveRankingSignatureRef.current = "";
    lastLiveRankingEmitMsRef.current = 0;
    progressCallbackRef.current?.([]);
    emitLiveRanking(0, true);

    function tick(now: number) {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const running = isRunningRef.current;

      if (running && startedAtRef.current === null) {
        startedAtRef.current = now;
      }

      const previous = lastFrameRef.current ?? now;
      const dt = running ? clamp((now - previous) / 1000, 0, 0.032) : 0;
      const elapsedMs =
        running && startedAtRef.current !== null ? now - startedAtRef.current : 0;
      const elapsedSeconds = elapsedMs / 1000;
      lastFrameRef.current = now;

      if (running) {
        updateBalls(dt, elapsedSeconds, elapsedMs);
      }

      updateCamera(running ? dt : 0.016);
      drawBoard(canvas, elapsedSeconds);

      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // The animation loop is driven by refs so camera changes do not restart physics.
  }, [candidates, runId, shuffleSeed]);

  function buildLiveRanking(): PinballLiveRankEntry[] {
    const finishedEntries: PinballLiveRankEntry[] = finishOrderRef.current.map(
      (entry) => ({
        candidate: entry.candidate,
        elapsedMs: entry.elapsedMs,
        isFinished: true,
        rank: entry.rank,
      }),
    );
    const finishedCandidateIds = new Set(
      finishedEntries.map((entry) => entry.candidate.id),
    );
    const activeEntries: PinballLiveRankEntry[] = ballsRef.current
      .filter(
        (ball) =>
          ball.finishElapsedMs === null &&
          !finishedCandidateIds.has(ball.candidate.id),
      )
      .sort((left, right) => {
        const yDelta = right.y - left.y;

        if (Math.abs(yDelta) > 0.001) {
          return yDelta;
        }

        return left.candidate.id - right.candidate.id;
      })
      .map((ball, index) => ({
        candidate: ball.candidate,
        elapsedMs: null,
        isFinished: false,
        rank: finishedEntries.length + index + 1,
      }));

    return [...finishedEntries, ...activeEntries];
  }

  function getLiveRankingSignature(ranking: readonly PinballLiveRankEntry[]) {
    return ranking
      .map((entry) =>
        `${entry.candidate.id}:${entry.rank}:${entry.isFinished ? "F" : "R"}`,
      )
      .join("|");
  }

  function emitLiveRanking(elapsedMs: number, force = false) {
    const callback = liveRankingCallbackRef.current;

    if (!callback) {
      return;
    }

    const ranking = buildLiveRanking();
    const signature = getLiveRankingSignature(ranking);
    const shouldEmit =
      force ||
      signature !== lastLiveRankingSignatureRef.current ||
      elapsedMs - lastLiveRankingEmitMsRef.current >= 120;

    if (!shouldEmit) {
      return;
    }

    lastLiveRankingSignatureRef.current = signature;
    lastLiveRankingEmitMsRef.current = elapsedMs;
    callback(ranking);
  }

  function stopObstacleAttacks() {
    obstacleHitEffectsRef.current = [];
    missileShotEffectsRef.current = [];

    for (const obstacle of obstaclesRef.current) {
      obstacle.targetCandidateId = null;
      obstacle.cooldownSeconds = OBSTACLE_FIRST_SHOT_DELAY_SECONDS;
      obstacle.firingSeconds = 0;
      setObstaclePhase(obstacle, "closed");
    }
  }

  function setObstaclePhase(obstacle: ObstacleState, phase: ObstacleVisualState) {
    if (obstacle.phase === phase) {
      return;
    }

    obstacle.phase = phase;
    obstacle.phaseElapsedSeconds = 0;
  }

  function isSingleObstacleTarget(obstacle: ObstacleState, ball: BallState) {
    if (ball.finishElapsedMs !== null) {
      return false;
    }

    const dx = ball.x - obstacle.x;
    const aboveDistance = obstacle.y - ball.y;

    return (
      aboveDistance >= TRAP_TARGET_MIN_ABOVE &&
      Math.abs(dx) <= obstacle.halfWidth &&
      Math.hypot(dx, aboveDistance) <= obstacle.range
    );
  }

  function isFireObstacleTarget(obstacle: ObstacleState, ball: BallState) {
    return (
      ball.finishElapsedMs === null &&
      ball.y <= obstacle.y + FIRE_TARGET_LOWER_MARGIN &&
      Math.hypot(ball.x - obstacle.x, ball.y - obstacle.y) <= obstacle.range
    );
  }

  function findNearestObstacleTarget(obstacle: ObstacleState) {
    let nearestBall: BallState | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const ball of ballsRef.current) {
      if (ball.finishElapsedMs !== null) {
        continue;
      }

      if (!isSingleObstacleTarget(obstacle, ball)) {
        continue;
      }

      const distance = Math.hypot(ball.x - obstacle.x, ball.y - obstacle.y);
      if (distance <= obstacle.range && distance < nearestDistance) {
        nearestBall = ball;
        nearestDistance = distance;
      }
    }

    return nearestBall;
  }

  function getCurrentObstacleTarget(obstacle: ObstacleState) {
    if (obstacle.targetCandidateId === null) {
      return null;
    }

    const currentTarget = ballsRef.current.find(
      (ball) => ball.candidate.id === obstacle.targetCandidateId,
    );

    return currentTarget && isSingleObstacleTarget(obstacle, currentTarget)
      ? currentTarget
      : null;
  }

  function findFireObstacleTargets(obstacle: ObstacleState) {
    return ballsRef.current.filter((ball) => isFireObstacleTarget(obstacle, ball));
  }

  function launchBallUp(kind: ObstacleKind, ball: BallState) {
    const pushForce = getObstaclePushForce(kind);

    ball.vx = clamp(ball.vx * 0.9, -1120, 1120);
    ball.vy = clamp(Math.min(ball.vy * 0.25, 0) - pushForce, -1120, 1120);
    ball.idleSeconds = 0;
  }

  function addObstacleHitEffect(kind: ObstacleKind, ball: BallState) {
    obstacleHitEffectsRef.current = [
      ...obstacleHitEffectsRef.current,
      { elapsedSeconds: 0, kind, x: ball.x, y: ball.y },
    ];
  }

  function fireSingleObstacle(obstacle: ObstacleState, ball: BallState) {
    launchBallUp(obstacle.kind, ball);
    addObstacleHitEffect(obstacle.kind, ball);

    if (obstacle.kind === "missile") {
      missileShotEffectsRef.current = [
        ...missileShotEffectsRef.current,
        {
          elapsedSeconds: 0,
          fromX: obstacle.x,
          fromY: obstacle.y,
          toX: ball.x,
          toY: ball.y,
        },
      ];
    }
  }

  function fireAreaObstacle(obstacle: ObstacleState, targets: BallState[]) {
    for (const ball of targets) {
      launchBallUp(obstacle.kind, ball);
      addObstacleHitEffect(obstacle.kind, ball);
    }
  }

  function closeIdleObstacle(obstacle: ObstacleState) {
    obstacle.cooldownSeconds = OBSTACLE_FIRST_SHOT_DELAY_SECONDS;
    obstacle.firingSeconds = 0;

    if (
      obstacle.phase === "open" ||
      obstacle.phase === "opening" ||
      obstacle.phase === "firing"
    ) {
      setObstaclePhase(obstacle, "closing");
    }

    if (
      obstacle.phase === "closing" &&
      obstacle.phaseElapsedSeconds >= OBSTACLE_CLOSE_SECONDS
    ) {
      setObstaclePhase(obstacle, "closed");
    }
  }

  function readyObstacleForAttack(obstacle: ObstacleState) {
    if (obstacle.phase === "closed" || obstacle.phase === "closing") {
      setObstaclePhase(obstacle, "opening");
      obstacle.cooldownSeconds = OBSTACLE_FIRST_SHOT_DELAY_SECONDS;
      return false;
    }

    if (
      obstacle.phase === "opening" &&
      obstacle.phaseElapsedSeconds >= OBSTACLE_OPEN_SECONDS
    ) {
      setObstaclePhase(obstacle, "open");
      obstacle.cooldownSeconds = Math.max(
        obstacle.cooldownSeconds,
        OBSTACLE_FIRST_SHOT_DELAY_SECONDS,
      );
    }

    if (obstacle.phase === "firing" && obstacle.firingSeconds <= 0) {
      setObstaclePhase(obstacle, "open");
    }

    return obstacle.phase === "open" && obstacle.cooldownSeconds <= 0;
  }

  function updateSingleTargetObstacle(obstacle: ObstacleState) {
    const currentTarget = getCurrentObstacleTarget(obstacle);

    if (!currentTarget) {
      obstacle.targetCandidateId = null;
    }

    const target = currentTarget ?? findNearestObstacleTarget(obstacle);
    obstacle.targetCandidateId = target?.candidate.id ?? null;

    if (!target) {
      closeIdleObstacle(obstacle);
      return;
    }

    obstacle.angle = Math.atan2(target.y - obstacle.y, target.x - obstacle.x);

    if (!readyObstacleForAttack(obstacle)) {
      return;
    }

    fireSingleObstacle(obstacle, target);
    setObstaclePhase(obstacle, "firing");
    obstacle.firingSeconds = OBSTACLE_FIRE_SECONDS;
    obstacle.cooldownSeconds = getObstacleCooldownSeconds(obstacle.kind);
  }

  function updateAreaObstacle(obstacle: ObstacleState) {
    obstacle.targetCandidateId = null;
    const targets = findFireObstacleTargets(obstacle);

    if (targets.length === 0) {
      closeIdleObstacle(obstacle);
      return;
    }

    if (!readyObstacleForAttack(obstacle)) {
      return;
    }

    fireAreaObstacle(obstacle, targets);
    setObstaclePhase(obstacle, "firing");
    obstacle.firingSeconds = OBSTACLE_FIRE_SECONDS;
    obstacle.cooldownSeconds = getObstacleCooldownSeconds(obstacle.kind);
  }

  function updateObstacle(dt: number, obstacle: ObstacleState) {
    obstacle.phaseElapsedSeconds += dt;
    obstacle.cooldownSeconds = Math.max(0, obstacle.cooldownSeconds - dt);
    obstacle.firingSeconds = Math.max(0, obstacle.firingSeconds - dt);

    if (obstacle.kind === "fire") {
      updateAreaObstacle(obstacle);
      return;
    }

    updateSingleTargetObstacle(obstacle);
  }

  function updateObstacles(dt: number) {
    const activeBallCount = ballsRef.current.filter(
      (ball) => ball.finishElapsedMs === null,
    ).length;

    if (activeBallCount <= 1) {
      stopObstacleAttacks();
      return;
    }

    obstacleHitEffectsRef.current = obstacleHitEffectsRef.current
      .map((effect) => ({
        ...effect,
        elapsedSeconds: effect.elapsedSeconds + dt,
      }))
      .filter((effect) => effect.elapsedSeconds < TRAP_HIT_EFFECT_SECONDS);

    missileShotEffectsRef.current = missileShotEffectsRef.current
      .map((effect) => ({
        ...effect,
        elapsedSeconds: effect.elapsedSeconds + dt,
      }))
      .filter((effect) => effect.elapsedSeconds < MISSILE_SHOT_EFFECT_SECONDS);

    for (const obstacle of obstaclesRef.current) {
      updateObstacle(dt, obstacle);
    }
  }

  function updateBalls(dt: number, elapsedSeconds: number, elapsedMs: number) {
    const balls = ballsRef.current;
    const tiltBars = tiltBarsRef.current;
    const gateOpening = getGateOpening(elapsedSeconds);
    const gateSegments = buildGateSegments(gateOpening);
    const barAngle = elapsedSeconds * GOAL_BAR_SPEED;
    const barSegment: Segment = {
      ax: GOAL_BAR_CENTER.x - Math.cos(barAngle) * GOAL_BAR_LENGTH * 0.5,
      ay: GOAL_BAR_CENTER.y - Math.sin(barAngle) * GOAL_BAR_LENGTH * 0.5,
      bx: GOAL_BAR_CENTER.x + Math.cos(barAngle) * GOAL_BAR_LENGTH * 0.5,
      by: GOAL_BAR_CENTER.y + Math.sin(barAngle) * GOAL_BAR_LENGTH * 0.5,
      tone: "guard",
    };
    const gravity = 560 + Math.min(elapsedSeconds, 18) * 18;

    for (const bar of tiltBars) {
      const angleDelta = bar.angle - bar.baseAngle;

      bar.angularVelocity += -angleDelta * 7.5 * dt;
      bar.angularVelocity *= Math.pow(0.08, dt);
      bar.angle += bar.angularVelocity * dt;

      const maxDelta = 0.72;
      const clampedDelta = clamp(bar.angle - bar.baseAngle, -maxDelta, maxDelta);

      if (clampedDelta !== bar.angle - bar.baseAngle) {
        bar.angle = bar.baseAngle + clampedDelta;
        bar.angularVelocity *= -0.35;
      }
    }

    for (const ball of balls) {
      if (ball.finishElapsedMs !== null) {
        continue;
      }

      const previousX = ball.x;
      const previousY = ball.y;

      ball.vy += gravity * dt;
      ball.vx *= 0.997;
      ball.vy *= 0.999;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < 34 + ball.radius) {
        ball.x = 34 + ball.radius;
        ball.vx = Math.abs(ball.vx) * 0.82 + 18;
      }

      if (ball.x > WORLD_WIDTH - 34 - ball.radius) {
        ball.x = WORLD_WIDTH - 34 - ball.radius;
        ball.vx = -Math.abs(ball.vx) * 0.82 - 18;
      }

      if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }

      for (const segment of STATIC_SEGMENTS) {
        collideSegment(ball, segment);
      }

      for (const bar of tiltBars) {
        collideTiltBar(ball, bar);
      }

      for (const segment of gateSegments) {
        collideSegment(ball, segment, 0.44);
      }

      collideSegment(ball, barSegment, 0.58, Math.sin(barAngle) * 34);
      collideGoalSideBlockers(ball, gateOpening);

      for (const pin of PINS) {
        collideCircle(ball, pin.x, pin.y, pin.radius);
      }

      for (const bumper of BUMPERS) {
        collideCircle(
          ball,
          bumper.x,
          bumper.y,
          bumper.radius,
          bumper.bounceMultiplier,
        );
      }

      const inGate =
        ball.x > WORLD_WIDTH / 2 - gateOpening / 2 + ball.radius * 0.25 &&
        ball.x < WORLD_WIDTH / 2 + gateOpening / 2 - ball.radius * 0.25;

      if (ball.y > FINISH_Y + 26 && inGate) {
        ball.finishElapsedMs = elapsedMs;
        ball.y = FINISH_Y + 74 + finishOrderRef.current.length * 20;
        ball.vx = 0;
        ball.vy = 0;
        const nextEntry: PinballFinishEntry = {
          candidate: ball.candidate,
          elapsedMs,
          rank: finishOrderRef.current.length + 1,
        };

        finishOrderRef.current = [...finishOrderRef.current, nextEntry];
        progressCallbackRef.current?.(finishOrderRef.current);

        if (followCandidateIdRef.current === ball.candidate.id) {
          followCandidateFinishedCallbackRef.current?.(ball.candidate.id);
        }

        if (finishOrderRef.current.length === balls.length) {
          finishCallbackRef.current(finishOrderRef.current);
        }
        continue;
      }

      if (ball.y > FINISH_Y + 10 && !inGate) {
        ball.y = FINISH_Y - ball.radius - 4;
        ball.vy = -Math.abs(ball.vy) * 0.48;
        ball.vx += ball.x < WORLD_WIDTH / 2 ? 60 : -60;
      }

      if (ball.y > WORLD_HEIGHT - ball.radius) {
        ball.y = WORLD_HEIGHT - ball.radius;
        ball.vy = -Math.abs(ball.vy) * 0.72;
      }

      const moved = Math.hypot(ball.x - previousX, ball.y - previousY);
      ball.idleSeconds = moved < 1.2 ? ball.idleSeconds + dt : 0;

      if (ball.idleSeconds > 1.8) {
        ball.vx += ball.x < WORLD_WIDTH / 2 ? 95 : -95;
        ball.vy += 160;
        ball.idleSeconds = 0;
      }
    }

    updateObstacles(dt);
    emitLiveRanking(elapsedMs);
  }

  function updateCamera(dt: number) {
    if (!autoCameraRef.current) {
      return;
    }

    const size = sizeRef.current;
    const scale = size.width / WORLD_WIDTH;
    const viewportWorldHeight = size.height / scale;
    const balls = ballsRef.current;
    const followedBall =
      typeof followCandidateIdRef.current === "number"
        ? balls.find(
            (ball) =>
              ball.candidate.id === followCandidateIdRef.current &&
              ball.finishElapsedMs === null,
          )
        : null;
    const leader =
      followedBall ??
      balls
        .filter((ball) => ball.finishElapsedMs === null)
        .sort((left, right) => right.y - left.y)[0] ??
      balls[balls.length - 1];

    if (!leader) {
      return;
    }

    const targetCamera = clamp(
      leader.y - viewportWorldHeight * 0.42,
      0,
      Math.max(WORLD_HEIGHT - viewportWorldHeight, 0),
    );
    const stiffness = 1 - Math.pow(0.015, dt);
    cameraYRef.current += (targetCamera - cameraYRef.current) * stiffness;
  }

  function drawBoard(canvas: HTMLCanvasElement, elapsedSeconds: number) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const size = sizeRef.current;
    const targetWidth = Math.floor(size.width * dpr);
    const targetHeight = Math.floor(size.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const scale = size.width / WORLD_WIDTH;
    const cameraY = cameraYRef.current;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(0, -cameraY);

    ctx.fillStyle = "#f6efe1";
    ctx.fillRect(0, cameraY, WORLD_WIDTH, size.height / scale);

    for (let y = Math.floor(cameraY / 120) * 120; y < cameraY + size.height / scale + 120; y += 120) {
      ctx.fillStyle = y % 240 === 0 ? "rgba(20,108,148,0.055)" : "rgba(211,111,59,0.045)";
      ctx.fillRect(34, y, WORLD_WIDTH - 68, 60);
    }

    ctx.fillStyle = "#f1d7a7";
    ctx.fillRect(34, 0, WORLD_WIDTH - 68, WORLD_HEIGHT);

    ctx.fillStyle = "#f8f1e4";
    ctx.fillRect(58, 30, WORLD_WIDTH - 116, WORLD_HEIGHT - 60);
    const gateOpening = getGateOpening(elapsedSeconds);

    drawGoalSideBlockers(ctx, gateOpening);

    for (const segment of STATIC_SEGMENTS) {
      drawSegment(ctx, segment);
    }

    for (const bar of tiltBarsRef.current) {
      drawTiltBar(ctx, bar);
    }

    for (const bumper of BUMPERS) {
      drawBumper(ctx, bumper);
    }

    ctx.fillStyle = "#274152";
    for (const pin of PINS) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const barAngle = elapsedSeconds * GOAL_BAR_SPEED;
    const halfBarLength = GOAL_BAR_LENGTH / 2;
    ctx.save();
    ctx.translate(GOAL_BAR_CENTER.x, GOAL_BAR_CENTER.y);
    ctx.rotate(barAngle);
    ctx.strokeStyle = "#f8f1e4";
    ctx.lineCap = "round";
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(-halfBarLength, 0);
    ctx.lineTo(halfBarLength, 0);
    ctx.stroke();
    ctx.strokeStyle = "#274152";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(-halfBarLength + 3, 0);
    ctx.lineTo(halfBarLength - 3, 0);
    ctx.stroke();
    ctx.restore();

    for (const segment of buildGateSegments(gateOpening)) {
      drawSegment(ctx, segment);
    }

    for (const obstacle of obstaclesRef.current) {
      drawObstacle(ctx, obstacle, trapAssetsRef.current);
    }

    ctx.save();
    ctx.fillStyle = "rgba(20,108,148,0.12)";
    ctx.fillRect(WORLD_WIDTH / 2 - gateOpening / 2, FINISH_Y + 8, gateOpening, 130);
    ctx.strokeStyle = "#146c94";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    ctx.moveTo(120, FINISH_Y + 78);
    ctx.lineTo(WORLD_WIDTH - 120, FINISH_Y + 78);
    ctx.stroke();
    ctx.restore();

    for (const ball of ballsRef.current) {
      ctx.save();
      ctx.globalAlpha = ball.finishElapsedMs === null ? 1 : 0.7;
      ctx.fillStyle = ball.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(23, 33, 43, 0.26)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#17212b";
      ctx.font = "700 18px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ball.candidate.userId, ball.x, ball.y - ball.radius - 10);
      ctx.font = "700 12px Pretendard, sans-serif";
      const badgeWidth = Math.max(
        34,
        ctx.measureText(ball.candidate.teamLabel).width + 16,
      );
      const badgeX = ball.x - badgeWidth / 2;
      const badgeY = ball.y + ball.radius + 8;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#274152";
      ctx.fillText(ball.candidate.teamLabel, ball.x, badgeY + 14);
      ctx.restore();
    }

    drawMissileShotEffects(ctx, missileShotEffectsRef.current, trapAssetsRef.current);
    drawObstacleHitEffects(ctx, obstacleHitEffectsRef.current, trapAssetsRef.current);

    ctx.restore();
  }

  function getPointerWorldPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scale = sizeRef.current.width / WORLD_WIDTH;

    return {
      x: x / scale,
      y: cameraYRef.current + y / scale,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startCameraY: cameraYRef.current,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - drag.startClientY;

    if (
      !drag.moved &&
      (Math.abs(deltaY) > 3 || Math.abs(event.clientX - drag.startClientX) > 3)
    ) {
      drag.moved = true;
      manualCameraCallbackRef.current?.();
    }

    if (drag.moved) {
      const scale = sizeRef.current.width / WORLD_WIDTH;
      const viewportWorldHeight = sizeRef.current.height / scale;
      autoCameraRef.current = false;
      cameraYRef.current = clamp(
        drag.startCameraY - deltaY / scale,
        0,
        Math.max(WORLD_HEIGHT - viewportWorldHeight, 0),
      );
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;

    if (!drag || drag.pointerId !== event.pointerId || drag.moved) {
      return;
    }

    const position = getPointerWorldPosition(event);

    if (!position) {
      return;
    }

    const hitBall = ballsRef.current.find(
      (ball) => Math.hypot(ball.x - position.x, ball.y - position.y) <= ball.radius + 18,
    );

    if (hitBall) {
      onSelectCandidate?.(hitBall.candidate.id);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[28px] border border-line bg-[linear-gradient(180deg,#fbf5ea_0%,#edf4f2_100%)] p-3 shadow-[0_18px_60px_rgba(23,33,43,0.12)]",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="block w-full shrink-0 cursor-grab rounded-[22px] border border-line bg-[#f8f1e4] active:cursor-grabbing"
        style={{ height: canvasSize.height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      />
      <p ref={footerRef} className="mt-3 px-2 text-xs leading-6 text-muted">
        기본 카메라는 선두 공을 따라갑니다. 선수를 누르면 해당 공을 따라가고,
        보드를 드래그하면 수동으로 볼 수 있습니다.
      </p>
    </div>
  );
}
