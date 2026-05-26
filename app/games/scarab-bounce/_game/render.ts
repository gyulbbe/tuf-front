import type {
  Block,
  BlockType,
  LevelDefinition,
  Particle,
  PlayerState,
  RunState,
  Spike,
} from "./types";
import {
  getBlockRect,
  getSpikeRect,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./physics";

type RenderOptions = {
  context: CanvasRenderingContext2D;
  elapsedSeconds: number;
  level: LevelDefinition;
  runState: RunState;
};

const WORLD_VIEW_SCALE = Math.min(
  VIEWPORT_WIDTH / WORLD_WIDTH,
  VIEWPORT_HEIGHT / WORLD_HEIGHT,
);
const WORLD_VIEW_OFFSET_X = (VIEWPORT_WIDTH - WORLD_WIDTH * WORLD_VIEW_SCALE) / 2;
const WORLD_VIEW_OFFSET_Y = (VIEWPORT_HEIGHT - WORLD_HEIGHT * WORLD_VIEW_SCALE) / 2;

export function renderGame({
  context,
  elapsedSeconds,
  level,
  runState,
}: RenderOptions): void {
  context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  drawBackground(context);

  context.save();
  context.translate(WORLD_VIEW_OFFSET_X, WORLD_VIEW_OFFSET_Y);
  context.scale(WORLD_VIEW_SCALE, WORLD_VIEW_SCALE);
  drawLevel(context, level, runState, elapsedSeconds);

  if (runState.phase === "playing") {
    drawScarab(context, runState.player, elapsedSeconds);
  }

  drawParticles(context, runState.particles);
  context.restore();

  drawHud(context, runState);
}

function drawBackground(context: CanvasRenderingContext2D): void {
  const gradient = context.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(0.58, "#172033");
  gradient.addColorStop(1, "#0e1726");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  context.save();
  context.translate(WORLD_VIEW_OFFSET_X, WORLD_VIEW_OFFSET_Y);
  context.scale(WORLD_VIEW_SCALE, WORLD_VIEW_SCALE);
  context.globalAlpha = 0.15;
  context.strokeStyle = "#6ee7f9";
  context.lineWidth = 1.5;

  const gridSize = 48;

  for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }

  for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }

  context.restore();

  context.fillStyle = "rgba(255, 255, 255, 0.62)";
  for (let index = 0; index < 56; index += 1) {
    const x = (index * 181) % WORLD_WIDTH;
    const y = 28 + ((index * 97) % Math.max(1, WORLD_HEIGHT - 160));
    const radius = 1 + (index % 3) * 0.65;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawLevel(
  context: CanvasRenderingContext2D,
  level: LevelDefinition,
  runState: RunState,
  elapsedSeconds: number,
): void {
  const removedBlockIds = new Set(runState.removedBlockIds);

  drawWorldBounds(context);

  for (const baseBlock of level.blocks) {
    if (removedBlockIds.has(baseBlock.id)) {
      continue;
    }

    const block = getBlockRect(baseBlock, elapsedSeconds);
    const style = getBlockStyle(block.type);
    const gradient = context.createLinearGradient(
      block.x,
      block.y,
      block.x,
      block.y + block.height,
    );
    gradient.addColorStop(0, style.top);
    gradient.addColorStop(0.48, style.middle);
    gradient.addColorStop(1, style.bottom);

    context.fillStyle = gradient;
    roundedRect(context, block.x, block.y, block.width, block.height, 7);
    context.fill();
    context.strokeStyle = style.stroke;
    context.lineWidth = 2;
    context.stroke();

    drawBlockPattern(context, block);
  }

  for (const spike of level.spikes) {
    drawSpike(context, getSpikeRect(spike, elapsedSeconds));
  }

  drawTarget(context, level.target.x, level.target.y, level.target.radius, elapsedSeconds);
}

function drawWorldBounds(context: CanvasRenderingContext2D): void {
  context.save();
  context.strokeStyle = "rgba(125, 211, 252, 0.22)";
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, WORLD_WIDTH - 3, WORLD_HEIGHT - 3);
  context.restore();
}

function getBlockStyle(type: BlockType) {
  switch (type) {
    case "breakable":
      return {
        bottom: "#92400e",
        middle: "#d97706",
        stroke: "#fde68a",
        top: "#f59e0b",
      };
    case "crumble":
      return {
        bottom: "#a16207",
        middle: "#ca8a04",
        stroke: "#fef3c7",
        top: "#fde68a",
      };
    case "high":
      return {
        bottom: "#15803d",
        middle: "#22c55e",
        stroke: "#fff7ad",
        top: "#fde047",
      };
    case "soft":
      return {
        bottom: "#4338ca",
        middle: "#6366f1",
        stroke: "#c7d2fe",
        top: "#a5b4fc",
      };
    case "wallJump":
      return {
        bottom: "#0e7490",
        middle: "#06b6d4",
        stroke: "#a5f3fc",
        top: "#67e8f9",
      };
    case "normal":
    default:
      return {
        bottom: "#2563eb",
        middle: "#38bdf8",
        stroke: "#dbeafe",
        top: "#93c5fd",
      };
  }
}

function drawBlockPattern(context: CanvasRenderingContext2D, block: Block): void {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.62)";
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 2;

  if (block.type === "high") {
    for (let x = block.x + 20; x < block.x + block.width - 12; x += 34) {
      context.beginPath();
      context.moveTo(x, block.y + block.height - 8);
      context.lineTo(x + 10, block.y + 8);
      context.lineTo(x + 20, block.y + block.height - 8);
      context.fill();
    }
  } else if (block.type === "soft") {
    for (let x = block.x + 14; x < block.x + block.width - 8; x += 24) {
      context.beginPath();
      context.ellipse(x, block.y + block.height / 2, 7, 3.5, 0, 0, Math.PI * 2);
      context.fill();
    }
  } else if (block.type === "crumble" || block.type === "breakable") {
    const crackCount = block.type === "breakable" ? 5 : 3;

    for (let index = 0; index < crackCount; index += 1) {
      const x = block.x + 12 + ((index * 29) % Math.max(24, block.width - 20));
      const y = block.y + 5 + (index % 3) * (block.height / 4);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 8, y + 6);
      context.lineTo(x + 4, y + 13);
      context.stroke();
    }
  } else if (block.type === "wallJump") {
    for (let y = block.y + 20; y < block.y + block.height - 8; y += 38) {
      context.beginPath();
      context.moveTo(block.x + block.width / 2, y - 10);
      context.lineTo(block.x + 8, y + 8);
      context.lineTo(block.x + block.width - 8, y + 8);
      context.closePath();
      context.fill();
    }
  }

  context.restore();
}

function drawSpike(context: CanvasRenderingContext2D, spike: Spike): void {
  const teeth = Math.max(1, Math.round(spike.width / 18));
  const toothWidth = spike.width / teeth;

  context.save();
  context.shadowBlur = 14;
  context.shadowColor = "#ef4444";
  context.fillStyle = "#ef4444";
  context.strokeStyle = "#fecaca";
  context.lineWidth = 1.5;

  for (let index = 0; index < teeth; index += 1) {
    const x = spike.x + toothWidth * index;
    context.beginPath();

    if (spike.orientation === "up") {
      context.moveTo(x, spike.y + spike.height);
      context.lineTo(x + toothWidth / 2, spike.y);
      context.lineTo(x + toothWidth, spike.y + spike.height);
    } else {
      context.moveTo(x, spike.y);
      context.lineTo(x + toothWidth / 2, spike.y + spike.height);
      context.lineTo(x + toothWidth, spike.y);
    }

    context.closePath();
    context.fill();
    context.stroke();
  }

  context.restore();
}

function drawTarget(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elapsedSeconds: number,
): void {
  const pulse = 1 + Math.sin(elapsedSeconds * 5) * 0.08;

  context.save();
  context.translate(x, y);
  context.scale(pulse, pulse);
  context.shadowBlur = 22;
  context.shadowColor = "#fef08a";
  context.fillStyle = "#facc15";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.beginPath();

  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const currentRadius = point % 2 === 0 ? radius : radius * 0.45;
    const px = Math.cos(angle) * currentRadius;
    const py = Math.sin(angle) * currentRadius;

    if (point === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }

  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawScarab(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  elapsedSeconds: number,
): void {
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.vx * 0.0012);

  const bob = Math.sin(elapsedSeconds * 18) * 1.2;
  const shellRadius = player.radius - 1;

  context.shadowBlur = 20;
  context.shadowColor = "#f97316";

  context.fillStyle = "rgba(251, 146, 60, 0.3)";
  context.beginPath();
  context.ellipse(-12, 9 + bob, 20, 7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f59e0b";
  context.strokeStyle = "#7c2d12";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, shellRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.save();
  context.clip();
  context.fillStyle = "#facc15";
  for (let index = -2; index <= 2; index += 1) {
    context.beginPath();
    context.ellipse(index * 6, -1, 4.6, 19, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#fb923c";
  context.beginPath();
  context.arc(11, 0, 10, -Math.PI / 2, Math.PI / 2);
  context.lineTo(0, 0);
  context.closePath();
  context.fill();
  context.restore();

  context.strokeStyle = "#fde68a";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, shellRadius - 5, Math.PI * 0.78, Math.PI * 1.22);
  context.stroke();

  context.fillStyle = "#111827";
  context.beginPath();
  context.arc(11, -5, 2.2, 0, Math.PI * 2);
  context.arc(11, 5, 2.2, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#fde68a";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-13, -9);
  context.lineTo(-24, -16);
  context.moveTo(-13, 9);
  context.lineTo(-24, 16);
  context.stroke();

  context.restore();
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const particle of particles) {
    const alpha = Math.max(0, 1 - particle.age / particle.life);

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.shadowBlur = 14;
    context.shadowColor = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawHud(
  context: CanvasRenderingContext2D,
  runState: RunState,
): void {
  context.save();

  if (runState.message) {
    context.textAlign = "center";
    context.fillStyle = "rgba(15, 23, 42, 0.76)";
    roundedRect(
      context,
      VIEWPORT_WIDTH / 2 - 210,
      VIEWPORT_HEIGHT / 2 - 48,
      420,
      96,
      16,
    );
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "800 34px Pretendard, sans-serif";
    context.fillText(runState.message, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 10);
  }

  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
