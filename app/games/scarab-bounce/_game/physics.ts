import type {
  Block,
  InputState,
  LevelDefinition,
  Particle,
  PlayerState,
  Rect,
  Spike,
  Vec2,
} from "./types";

export const VIEWPORT_WIDTH = 960;
export const VIEWPORT_HEIGHT = 540;
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;
export const PLAYER_RADIUS = 20;

const GRAVITY = 2100;
const MOVE_ACCELERATION = 1880;
const MAX_HORIZONTAL_SPEED = 430;
const AIR_DRAG = 2.05;
const NORMAL_BOUNCE_SPEED = 760;
const HIGH_BOUNCE_MULTIPLIER = 1.75;
const SOFT_BOUNCE_MULTIPLIER = 0.55;
const WALL_JUMP_SPEED = 940;
const WALL_KICK_SPEED = 365;
const DEFAULT_BREAK_SPEED = 245;
const MAX_DELTA_SECONDS = 1 / 30;

export type PhysicsStepResult = {
  event: "clear" | "lost" | null;
  particles: Particle[];
  removedBlockIds: string[];
};

type CollisionResult = {
  particles: Particle[];
  removedBlockId?: string;
};

export function createPlayer(start: Vec2): PlayerState {
  return {
    radius: PLAYER_RADIUS,
    vx: 0,
    vy: 0,
    x: start.x,
    y: start.y,
  };
}

export function getBlockRect(block: Block, elapsedSeconds: number): Block {
  if (!block.motion) {
    return block;
  }

  const value = getMotionValue(block.motion, elapsedSeconds);

  return {
    ...block,
    x: block.motion.axis === "x" ? value : block.x,
    y: block.motion.axis === "y" ? value : block.y,
  };
}

export function getSpikeRect(spike: Spike, elapsedSeconds: number): Spike {
  if (!spike.motion) {
    return spike;
  }

  const value = getMotionValue(spike.motion, elapsedSeconds);

  return {
    ...spike,
    x: spike.motion.axis === "x" ? value : spike.x,
    y: spike.motion.axis === "y" ? value : spike.y,
  };
}

export function stepPhysics({
  elapsedSeconds,
  input,
  level,
  player,
  rawDeltaSeconds,
  removedBlockIds,
}: {
  elapsedSeconds: number;
  input: InputState;
  level: LevelDefinition;
  player: PlayerState;
  rawDeltaSeconds: number;
  removedBlockIds: readonly string[];
}): PhysicsStepResult {
  const dt = Math.min(rawDeltaSeconds, MAX_DELTA_SECONDS);
  const previous = { x: player.x, y: player.y };
  const direction = Number(input.right) - Number(input.left);
  const removedSet = new Set(removedBlockIds);
  const nextRemovedBlockIds: string[] = [];
  const particles: Particle[] = [];

  if (direction !== 0) {
    player.vx += direction * MOVE_ACCELERATION * dt;
  } else {
    player.vx *= Math.exp(-AIR_DRAG * dt);
  }

  player.vx = clamp(player.vx, -MAX_HORIZONTAL_SPEED, MAX_HORIZONTAL_SPEED);
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < player.radius) {
    player.x = player.radius;
    player.vx = Math.max(0, player.vx);
  } else if (player.x > WORLD_WIDTH - player.radius) {
    player.x = WORLD_WIDTH - player.radius;
    player.vx = Math.min(0, player.vx);
  }

  for (const baseBlock of level.blocks) {
    if (removedSet.has(baseBlock.id)) {
      continue;
    }

    const block = getBlockRect(baseBlock, elapsedSeconds);
    const result = resolveBlockCollision(player, previous, block);

    if (result.removedBlockId && !removedSet.has(result.removedBlockId)) {
      removedSet.add(result.removedBlockId);
      nextRemovedBlockIds.push(result.removedBlockId);
    }

    particles.push(...result.particles);
  }

  if (circleCircleOverlap(player, level.target)) {
    return { event: "clear", particles, removedBlockIds: nextRemovedBlockIds };
  }

  for (const spike of level.spikes) {
    if (circleRectOverlap(player, getSpikeRect(spike, elapsedSeconds))) {
      return { event: "lost", particles, removedBlockIds: nextRemovedBlockIds };
    }
  }

  if (player.y - player.radius > WORLD_HEIGHT + 16) {
    return { event: "lost", particles, removedBlockIds: nextRemovedBlockIds };
  }

  return { event: null, particles, removedBlockIds: nextRemovedBlockIds };
}

export function updateParticles(particles: Particle[], deltaSeconds: number): Particle[] {
  const dt = Math.min(deltaSeconds, MAX_DELTA_SECONDS);

  return particles
    .map((particle) => ({
      ...particle,
      age: particle.age + dt,
      radius: Math.max(0, particle.radius - dt * 9),
      vx: particle.vx * Math.exp(-1.4 * dt),
      vy: particle.vy + GRAVITY * 0.28 * dt,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
    }))
    .filter((particle) => particle.age < particle.life && particle.radius > 0.4);
}

export function createExplosion(
  x: number,
  y: number,
  colors = ["#facc15", "#fb923c", "#f97316", "#ffffff"],
  count = 34,
): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.5;
    const speed = 120 + Math.random() * 280;

    return {
      age: 0,
      color: colors[index % colors.length],
      life: 0.5 + Math.random() * 0.45,
      radius: 4 + Math.random() * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      x,
      y,
    };
  });
}

function resolveBlockCollision(
  player: PlayerState,
  previous: Vec2,
  block: Block,
): CollisionResult {
  if (!circleRectOverlap(player, block)) {
    return { particles: [] };
  }

  const previousBottom = previous.y + player.radius;
  const previousTop = previous.y - player.radius;
  const previousRight = previous.x + player.radius;
  const previousLeft = previous.x - player.radius;
  const blockBottom = block.y + block.height;
  const blockRight = block.x + block.width;

  if (previousBottom <= block.y + 4 && player.vy >= 0) {
    player.y = block.y - player.radius;
    player.vy = -getBounceSpeed(block);

    if (block.type === "crumble") {
      return {
        particles: createDebris(block),
        removedBlockId: block.id,
      };
    }

    return { particles: [] };
  }

  if (previousTop >= blockBottom - 2 && player.vy < 0) {
    player.y = blockBottom + player.radius;
    player.vy = 0;
    return { particles: [] };
  }

  if (previousRight <= block.x && player.vx > 0) {
    return resolveSideCollision(player, block, "left");
  }

  if (previousLeft >= blockRight && player.vx < 0) {
    return resolveSideCollision(player, block, "right");
  }

  const centerX = block.x + block.width / 2;
  const centerY = block.y + block.height / 2;
  const overlapX = block.width / 2 + player.radius - Math.abs(player.x - centerX);
  const overlapY = block.height / 2 + player.radius - Math.abs(player.y - centerY);

  if (overlapY <= overlapX && player.y < centerY) {
    player.y = block.y - player.radius;
    player.vy = -getBounceSpeed(block);

    if (block.type === "crumble") {
      return {
        particles: createDebris(block),
        removedBlockId: block.id,
      };
    }
  } else if (overlapY <= overlapX) {
    player.y = blockBottom + player.radius;
    player.vy = Math.max(0, player.vy);
  } else if (player.x < centerX) {
    return resolveSideCollision(player, block, "left");
  } else {
    return resolveSideCollision(player, block, "right");
  }

  return { particles: [] };
}

function resolveSideCollision(
  player: PlayerState,
  block: Block,
  side: "left" | "right",
): CollisionResult {
  const blockRight = block.x + block.width;
  const speed = Math.abs(player.vx);

  if (block.type === "breakable" && speed >= (block.breakSpeed ?? DEFAULT_BREAK_SPEED)) {
    player.vx *= 0.58;
    player.vy = Math.min(player.vy, -NORMAL_BOUNCE_SPEED * 0.25);

    return {
      particles: createDebris(block, ["#f59e0b", "#92400e", "#fde68a"]),
      removedBlockId: block.id,
    };
  }

  if (side === "left") {
    player.x = block.x - player.radius;
    player.vx = block.type === "wallJump" ? -WALL_KICK_SPEED : Math.min(0, player.vx);
  } else {
    player.x = blockRight + player.radius;
    player.vx = block.type === "wallJump" ? WALL_KICK_SPEED : Math.max(0, player.vx);
  }

  if (block.type === "wallJump") {
    player.vy = Math.min(player.vy, -WALL_JUMP_SPEED);
  }

  return { particles: [] };
}

function getBounceSpeed(block: Block): number {
  if (block.type === "high") {
    return NORMAL_BOUNCE_SPEED * HIGH_BOUNCE_MULTIPLIER;
  }

  if (block.type === "soft") {
    return NORMAL_BOUNCE_SPEED * SOFT_BOUNCE_MULTIPLIER;
  }

  return NORMAL_BOUNCE_SPEED;
}

function createDebris(
  block: Block,
  colors = ["#facc15", "#fde68a", "#f97316"],
): Particle[] {
  const centerX = block.x + block.width / 2;
  const centerY = block.y + block.height / 2;
  const count = Math.max(8, Math.round(block.width / 14));

  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI + (Math.PI * 2 * index) / count;
    const speed = 70 + (index % 5) * 28;

    return {
      age: 0,
      color: colors[index % colors.length],
      life: 0.38 + (index % 4) * 0.08,
      radius: 3 + (index % 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      x: centerX,
      y: centerY,
    };
  });
}

function getMotionValue(
  motion: {
    max: number;
    min: number;
    phase?: number;
    speed: number;
  },
  elapsedSeconds: number,
): number {
  const wave =
    0.5 + Math.sin(elapsedSeconds * motion.speed + (motion.phase ?? 0)) * 0.5;

  return motion.min + (motion.max - motion.min) * wave;
}

function circleRectOverlap(circle: PlayerState, rect: Rect): boolean {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;

  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function circleCircleOverlap(
  circle: PlayerState,
  target: { radius: number; x: number; y: number },
): boolean {
  const dx = circle.x - target.x;
  const dy = circle.y - target.y;
  const radius = circle.radius + target.radius;

  return dx * dx + dy * dy <= radius * radius;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
