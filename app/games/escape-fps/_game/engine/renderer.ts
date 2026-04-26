import { FLOOR_SAMPLE_STEP, MAX_SHADE_DISTANCE } from "../lib/constants";
import { WEAPON_EFFECTS } from "../lib/effects-config";
import type { RayHit, Vec2, World } from "../lib/types";
import { WEAPONS } from "../lib/weapons";
import type { WeaponId } from "../lib/weapons";
import type { InventoryState } from "../state/inventory";
import type { ImageAssets } from "./assets";
import { getActiveEffects, getCameraShake, getEffectProgress } from "./effects";
import type { Effect } from "./effects";
import { castRay } from "./raycaster";
import { renderSprites } from "./sprites";
import type { CanvasTexture, TextureSet } from "./textures";
import { getTextureSet } from "./textures";
import { getWeaponImage } from "./weapon-assets";

type RenderWorldOptions = {
  imageAssets: ImageAssets;
  inputFiring: boolean;
  inventory: InventoryState;
  isRunning: boolean;
  now: number;
  playerVelocity: Vec2;
};

type RenderBuffers = {
  floorCanvas: HTMLCanvasElement | null;
  floorContext: CanvasRenderingContext2D | null;
  floorImageData: ImageData;
  height: number;
  width: number;
  zBuffer: Float32Array;
};

type ScreenProjection = {
  depth: number;
  x: number;
  y: number;
};

type WeaponRenderInfo = {
  muzzleX: number;
  muzzleY: number;
  weapon: WeaponId;
};

const SIDE_SHADE: Record<RayHit["side"], number> = {
  eastWest: 0.72,
  northSouth: 1,
};

const renderBuffers: RenderBuffers = {
  floorCanvas: null,
  floorContext: null,
  floorImageData: new ImageData(1, 1),
  height: 0,
  width: 0,
  zBuffer: new Float32Array(0),
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isVec2(value: unknown): value is Vec2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeVec = value as Partial<Vec2>;

  return typeof maybeVec.x === "number" && typeof maybeVec.y === "number";
}

function getEffectVec2(effect: Effect, key: string): Vec2 | null {
  const value = effect.data[key];

  return isVec2(value) ? value : null;
}

function getEffectNumber(
  effect: Effect,
  key: string,
  fallback: number,
): number {
  const value = effect.data[key];

  return typeof value === "number" ? value : fallback;
}

function getEffectWeapon(effect: Effect): WeaponId | null {
  const value = effect.data.weapon;

  if (
    value === "flamethrower" ||
    value === "machinegun" ||
    value === "rifle"
  ) {
    return value;
  }

  return null;
}

function getEffectString(effect: Effect, key: string): string | null {
  const value = effect.data[key];

  return typeof value === "string" ? value : null;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededUnit(seed: string, index: number): number {
  const mixed = Math.sin(hashString(`${seed}:${index}`) * 12.9898) * 43758.5453;

  return mixed - Math.floor(mixed);
}

function getTextureSample(
  texture: CanvasTexture,
  worldX: number,
  worldY: number,
): [number, number, number] {
  const textureX =
    ((Math.floor(worldX * texture.size) % texture.size) + texture.size) %
    texture.size;
  const textureY =
    ((Math.floor(worldY * texture.size) % texture.size) + texture.size) %
    texture.size;
  const offset = (textureY * texture.size + textureX) * 4;

  return [
    texture.data[offset] ?? 0,
    texture.data[offset + 1] ?? 0,
    texture.data[offset + 2] ?? 0,
  ];
}

function renderFloorAndCeiling(
  context: CanvasRenderingContext2D,
  world: World,
  textures: TextureSet,
  buffers: RenderBuffers,
): void {
  if (!buffers.floorContext || !buffers.floorCanvas) {
    return;
  }

  const { canvas } = context;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = buffers.floorImageData;
  const data = imageData.data;
  const { dir, plane, pos } = world.player;
  const horizonY = height / 2 + world.lookV;
  const rayDirX0 = dir.x - plane.x;
  const rayDirY0 = dir.y - plane.y;
  const rayDirX1 = dir.x + plane.x;
  const rayDirY1 = dir.y + plane.y;

  for (let y = 0; y < height; y += FLOOR_SAMPLE_STEP) {
    const isFloor = y >= horizonY;
    const p = Math.abs(y - horizonY);
    const texture = isFloor ? textures.floor : textures.ceiling;

    if (p < 1) {
      continue;
    }

    const rowDistance = (height * 0.5) / p;
    const floorStepX = (rowDistance * (rayDirX1 - rayDirX0)) / width;
    const floorStepY = (rowDistance * (rayDirY1 - rayDirY0)) / width;
    let floorX = pos.x + rowDistance * rayDirX0;
    let floorY = pos.y + rowDistance * rayDirY0;
    const brightness = isFloor
      ? clamp(1 - rowDistance / 18, 0.28, 1)
      : clamp(1 - rowDistance / 14, 0.18, 0.62);

    for (let x = 0; x < width; x += FLOOR_SAMPLE_STEP) {
      const [r, g, b] = getTextureSample(texture, floorX, floorY);
      const shadedR = Math.round(r * brightness);
      const shadedG = Math.round(g * brightness);
      const shadedB = Math.round(b * brightness);

      for (
        let blockY = y;
        blockY < Math.min(y + FLOOR_SAMPLE_STEP, height);
        blockY += 1
      ) {
        for (
          let blockX = x;
          blockX < Math.min(x + FLOOR_SAMPLE_STEP, width);
          blockX += 1
        ) {
          const offset = (blockY * width + blockX) * 4;

          data[offset] = shadedR;
          data[offset + 1] = shadedG;
          data[offset + 2] = shadedB;
          data[offset + 3] = 255;
        }
      }

      floorX += floorStepX * FLOOR_SAMPLE_STEP;
      floorY += floorStepY * FLOOR_SAMPLE_STEP;
    }
  }

  buffers.floorContext.putImageData(imageData, 0, 0);
  context.drawImage(buffers.floorCanvas, 0, 0);
}

function getRenderBuffers(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): RenderBuffers {
  if (!renderBuffers.floorCanvas || !renderBuffers.floorContext) {
    const floorCanvas = context.canvas.ownerDocument.createElement("canvas");
    const floorContext = floorCanvas.getContext("2d");

    if (!floorContext) {
      throw new Error("2D floor buffer context is unavailable.");
    }

    renderBuffers.floorCanvas = floorCanvas;
    renderBuffers.floorContext = floorContext;
  }

  if (renderBuffers.width !== width || renderBuffers.height !== height) {
    renderBuffers.width = width;
    renderBuffers.height = height;
    renderBuffers.zBuffer = new Float32Array(width);
    renderBuffers.floorImageData = context.createImageData(width, height);
    renderBuffers.floorCanvas.width = width;
    renderBuffers.floorCanvas.height = height;
    renderBuffers.floorContext.imageSmoothingEnabled = false;
  }

  return renderBuffers;
}

function getWallTexture(textures: TextureSet, wallValue: number): CanvasTexture {
  return textures.walls[wallValue] ?? textures.walls[1];
}

function getWallTextureX(hit: RayHit, texture: CanvasTexture): number {
  let textureX = Math.floor(hit.wallX * texture.size);

  if (
    (hit.side === "northSouth" && hit.rayDir.x > 0) ||
    (hit.side === "eastWest" && hit.rayDir.y < 0)
  ) {
    textureX = texture.size - textureX - 1;
  }

  return clamp(textureX, 0, texture.size - 1);
}

function renderWallColumn(
  context: CanvasRenderingContext2D,
  hit: RayHit,
  textures: TextureSet,
  screenX: number,
  lineHeight: number,
  drawStart: number,
  drawEnd: number,
  unclampedStart: number,
): void {
  const texture = getWallTexture(textures, hit.wallValue);
  const textureX = getWallTextureX(hit, texture);
  const visibleHeight = drawEnd - drawStart + 1;
  const textureY = clamp(
    ((drawStart - unclampedStart) / lineHeight) * texture.size,
    0,
    texture.size - 1,
  );
  const textureHeight = clamp(
    (visibleHeight / lineHeight) * texture.size,
    1,
    texture.size - textureY,
  );
  const sideShade = SIDE_SHADE[hit.side];
  const distanceShade = clamp(hit.distance / MAX_SHADE_DISTANCE, 0, 0.88);
  const shadeAlpha = clamp(1 - (1 - distanceShade) * sideShade, 0, 0.9);

  context.drawImage(
    texture.canvas,
    textureX,
    textureY,
    1,
    textureHeight,
    screenX,
    drawStart,
    1,
    visibleHeight,
  );

  if (shadeAlpha <= 0) {
    return;
  }

  context.fillStyle = `rgba(0, 0, 0, ${shadeAlpha})`;
  context.fillRect(screenX, drawStart, 1, visibleHeight);
}

function projectWorldPoint(
  world: World,
  point: Vec2,
  width: number,
  height: number,
): ScreenProjection | null {
  const { dir, plane, pos } = world.player;
  const spriteX = point.x - pos.x;
  const spriteY = point.y - pos.y;
  const invDet = 1 / (plane.x * dir.y - dir.x * plane.y);
  const transformX = invDet * (dir.y * spriteX - dir.x * spriteY);
  const transformY = invDet * (-plane.y * spriteX + plane.x * spriteY);

  if (transformY <= 0.05) {
    return null;
  }

  return {
    depth: transformY,
    x: Math.floor((width / 2) * (1 + transformX / transformY)),
    y: Math.floor(height / 2 + world.lookV),
  };
}

function renderTracer(
  context: CanvasRenderingContext2D,
  world: World,
  effect: Effect,
  now: number,
): void {
  const from = getEffectVec2(effect, "from");
  const to = getEffectVec2(effect, "to");
  const weapon = getEffectWeapon(effect);

  if (!from || !to || !weapon) {
    return;
  }

  const { canvas } = context;
  const progress = getEffectProgress(effect, now);
  const config = WEAPON_EFFECTS[weapon].tracer;
  const start = projectWorldPoint(world, from, canvas.width, canvas.height);
  const end = projectWorldPoint(world, to, canvas.width, canvas.height);

  if (!config || !end) {
    return;
  }

  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = config.color;
  context.lineWidth = config.widthPx;
  context.beginPath();
  context.moveTo(start?.x ?? canvas.width / 2, start?.y ?? canvas.height / 2 + world.lookV);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

function renderWallSpark(
  context: CanvasRenderingContext2D,
  world: World,
  effect: Effect,
  now: number,
): void {
  const pos = getEffectVec2(effect, "pos");
  const weapon = getEffectWeapon(effect);

  if (!pos || !weapon) {
    return;
  }

  const projection = projectWorldPoint(
    world,
    pos,
    context.canvas.width,
    context.canvas.height,
  );

  if (!projection) {
    return;
  }

  const progress = getEffectProgress(effect, now);
  const config = WEAPON_EFFECTS[weapon].wallSpark;
  const sparkCount = 7;
  const [minSize, maxSize] = config.sizeRange;

  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = config.color;
  context.lineWidth = 1.5;

  for (let index = 0; index < sparkCount; index += 1) {
    const angle = seededUnit(effect.id, index) * Math.PI * 2;
    const baseLength =
      minSize + seededUnit(effect.id, index + 20) * (maxSize - minSize);
    const length = baseLength * (1 + progress * 1.4);

    context.beginPath();
    context.moveTo(projection.x, projection.y);
    context.lineTo(
      projection.x + Math.cos(angle) * length,
      projection.y + Math.sin(angle) * length,
    );
    context.stroke();
  }

  context.restore();
}

function renderBloodSplat(
  context: CanvasRenderingContext2D,
  world: World,
  effect: Effect,
  now: number,
): void {
  const pos = getEffectVec2(effect, "pos");

  if (!pos) {
    return;
  }

  const projection = projectWorldPoint(
    world,
    pos,
    context.canvas.width,
    context.canvas.height,
  );

  if (!projection) {
    return;
  }

  const progress = getEffectProgress(effect, now);
  const scale = getEffectNumber(effect, "scale", 1);
  const particleCount = Math.round(12 + scale * 8);

  context.save();
  context.globalAlpha = 1 - progress;
  context.fillStyle = "rgba(160, 0, 0, 0.95)";

  for (let index = 0; index < particleCount; index += 1) {
    const angle = seededUnit(effect.id, index) * Math.PI * 2;
    const distance = (6 + seededUnit(effect.id, index + 40) * 28) * scale * progress;
    const gravity = 20 * scale * progress * progress;
    const radius = 1.5 + seededUnit(effect.id, index + 80) * 2.4 * scale;

    context.beginPath();
    context.arc(
      projection.x + Math.cos(angle) * distance,
      projection.y + Math.sin(angle) * distance + gravity,
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.restore();
}

function renderExplosion(
  context: CanvasRenderingContext2D,
  world: World,
  effect: Effect,
  now: number,
): void {
  const pos = getEffectVec2(effect, "pos");

  if (!pos) {
    return;
  }

  const projection = projectWorldPoint(
    world,
    pos,
    context.canvas.width,
    context.canvas.height,
  );

  if (!projection) {
    return;
  }

  const progress = getEffectProgress(effect, now);
  const worldRadius = getEffectNumber(effect, "radius", 1.5);
  const screenRadius =
    ((context.canvas.height / projection.depth) * worldRadius * (0.2 + progress)) /
    2;
  const gradient = context.createRadialGradient(
    projection.x,
    projection.y,
    0,
    projection.x,
    projection.y,
    screenRadius,
  );

  gradient.addColorStop(0, progress < 0.3 ? "rgba(255,255,255,0.95)" : "rgba(255,214,80,0.8)");
  gradient.addColorStop(0.45, "rgba(255,132,34,0.65)");
  gradient.addColorStop(1, `rgba(0,0,0,${0.5 * (1 - progress)})`);

  context.save();
  context.globalAlpha = 1 - progress * 0.75;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(projection.x, projection.y, screenRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 178, 55, 0.85)";
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const distance = screenRadius * (0.4 + progress * 0.8);

    context.beginPath();
    context.arc(
      projection.x + Math.cos(angle) * distance,
      projection.y + Math.sin(angle) * distance,
      Math.max(2, screenRadius * 0.05),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.restore();
}

function renderEnemyShot(
  context: CanvasRenderingContext2D,
  world: World,
  effect: Effect,
  now: number,
  imageAssets: ImageAssets,
): void {
  const from = getEffectVec2(effect, "from");
  const to = getEffectVec2(effect, "to");

  if (!from || !to) {
    return;
  }

  const { canvas } = context;
  const progress = getEffectProgress(effect, now);
  const start = projectWorldPoint(world, from, canvas.width, canvas.height);
  const end = projectWorldPoint(world, to, canvas.width, canvas.height);

  if (!start || !end) {
    return;
  }

  const enemyType = getEffectString(effect, "enemy");
  const projectileKey = getEffectString(effect, "projectileKey");
  const projectileImage = projectileKey ? imageAssets[projectileKey] : null;
  const color =
    enemyType === "spitter"
      ? "rgba(120,255,80,0.9)"
      : enemyType === "impaler"
        ? "rgba(210,120,255,0.92)"
        : "rgba(255,80,65,0.88)";
  const headX = start.x + (end.x - start.x) * progress;
  const headY = start.y + (end.y - start.y) * progress;
  const tailProgress = Math.max(0, progress - 0.18);
  const tailX = start.x + (end.x - start.x) * tailProgress;
  const tailY = start.y + (end.y - start.y) * tailProgress;
  const radius = 8 + Math.sin(progress * Math.PI) * 8;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = Math.max(0, 1 - progress * 0.15);
  context.strokeStyle = "rgba(255,255,255,0.3)";
  context.lineWidth = 12;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(headX, headY);
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(tailX, tailY);
  context.lineTo(headX, headY);
  context.stroke();

  if (projectileImage) {
    const imageSize = radius * 3.2;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    context.translate(headX, headY);
    context.rotate(angle);
    context.drawImage(
      projectileImage,
      -imageSize / 2,
      -imageSize / 2,
      imageSize,
      imageSize,
    );
    context.restore();
    return;
  }

  const gradient = context.createRadialGradient(headX, headY, 0, headX, headY, radius);

  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(headX, headY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function renderWorldEffects(
  context: CanvasRenderingContext2D,
  world: World,
  now: number,
  imageAssets: ImageAssets,
): void {
  for (const effect of getActiveEffects()) {
    if (effect.type === "tracer") {
      renderTracer(context, world, effect, now);
    } else if (effect.type === "wall-spark") {
      renderWallSpark(context, world, effect, now);
    } else if (effect.type === "blood-splat") {
      renderBloodSplat(context, world, effect, now);
    } else if (effect.type === "explosion") {
      renderExplosion(context, world, effect, now);
    } else if (effect.type === "enemy-shot") {
      renderEnemyShot(context, world, effect, now, imageAssets);
    }
  }
}

function renderFlamethrowerCone(
  context: CanvasRenderingContext2D,
  options: RenderWorldOptions,
): void {
  if (
    options.inventory.current !== "flamethrower" ||
    !options.inputFiring ||
    options.inventory.isReloading
  ) {
    return;
  }

  const { canvas } = context;
  const centerX = canvas.width / 2;
  const bottomY = canvas.height;
  const flameTopY = canvas.height * 0.43;
  const time = options.now * 0.018;
  const leftJitter = Math.sin(time) * 5 + Math.cos(time * 1.7) * 3;
  const rightJitter = Math.cos(time * 1.3) * 5 + Math.sin(time * 2.1) * 3;
  const tipJitter = Math.sin(time * 2.6) * 5;
  const gradient = context.createLinearGradient(centerX, bottomY, centerX, flameTopY);

  gradient.addColorStop(0, "rgba(160, 20, 10, 0.12)");
  gradient.addColorStop(0.35, "rgba(255, 72, 18, 0.52)");
  gradient.addColorStop(0.68, "rgba(255, 198, 48, 0.48)");
  gradient.addColorStop(1, "rgba(255, 255, 230, 0.25)");

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(centerX - canvas.width * 0.2 + leftJitter, bottomY);
  context.lineTo(centerX + tipJitter, flameTopY);
  context.lineTo(centerX + canvas.width * 0.2 + rightJitter, bottomY);
  context.closePath();
  context.fill();

  for (let index = 0; index < 22; index += 1) {
    const seed = options.now * 0.001 + index * 13;
    const t = (Math.sin(seed) + 1) / 2;
    const spread = (Math.cos(seed * 1.7) + 1) / 2 - 0.5;
    const x = centerX + spread * canvas.width * 0.3 * (1 - t * 0.35);
    const y = bottomY - t * (bottomY - flameTopY);
    const radius = 1.5 + ((Math.sin(seed * 2.3) + 1) / 2) * 3.5;

    context.fillStyle = t > 0.7 ? "rgba(255,255,210,0.55)" : "rgba(255,122,20,0.35)";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function getWeaponImageKey(weapon: WeaponId): string {
  return `weapon-${weapon}-0`;
}

function renderWeaponView(
  context: CanvasRenderingContext2D,
  options: RenderWorldOptions,
): WeaponRenderInfo | null {
  const { canvas } = context;
  const weapon = WEAPONS[options.inventory.current];

  if (weapon.id === "rifle" && options.inventory.isAiming) {
    return {
      muzzleX: canvas.width / 2,
      muzzleY: canvas.height / 2,
      weapon: weapon.id,
    };
  }

  const speed = Math.hypot(options.playerVelocity.x, options.playerVelocity.y);
  const swayPhase = (options.now / 1000) * (options.isRunning ? 12 : 8);
  const aimSway = options.inventory.isAiming ? 0.3 : 1;
  const swayX = Math.sin(swayPhase) * speed * 8 * aimSway;
  const swayY = Math.abs(Math.sin(swayPhase * 2)) * speed * 4 * aimSway;
  const weaponSize = Math.min(canvas.width * 0.38, canvas.height * 0.48);
  const weaponX = canvas.width / 2 - weaponSize / 2 + swayX;
  const weaponY = canvas.height - weaponSize + 28 + swayY;
  const r2WeaponImage = options.imageAssets[getWeaponImageKey(weapon.id)];
  const fallbackImage = getWeaponImage(weapon.id);
  const weaponImage = r2WeaponImage ?? fallbackImage;
  const muzzleX = weaponX + weaponSize * (weapon.id === "rifle" ? 0.78 : 0.72);
  const muzzleY = weaponY + weaponSize * (weapon.id === "flamethrower" ? 0.42 : 0.38);

  context.save();
  context.globalAlpha = 0.95;

  if (weaponImage) {
    context.drawImage(weaponImage, weaponX, weaponY, weaponSize, weaponSize);
  } else {
    context.fillStyle = weapon.hudColor;
    context.fillRect(weaponX, weaponY, weaponSize, weaponSize * 0.35);
    context.strokeStyle = "rgba(255, 255, 255, 0.28)";
    context.lineWidth = 2;
    context.strokeRect(weaponX, weaponY, weaponSize, weaponSize * 0.35);
  }

  context.restore();

  return { muzzleX, muzzleY, weapon: weapon.id };
}

function renderMuzzleFlash(
  context: CanvasRenderingContext2D,
  effect: Effect,
  options: RenderWorldOptions,
  weaponInfo: WeaponRenderInfo,
): void {
  const weapon = getEffectWeapon(effect) ?? weaponInfo.weapon;
  const config = WEAPON_EFFECTS[weapon].muzzleFlash;

  if (config.size <= 0) {
    return;
  }

  const progress = getEffectProgress(effect, options.now);
  const alpha = 1 - progress;
  const size = config.size * (1 - progress * 0.35);
  const image = options.imageAssets["muzzle-flash-0"];

  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = "lighter";

  if (image) {
    context.drawImage(
      image,
      weaponInfo.muzzleX - size / 2,
      weaponInfo.muzzleY - size / 2,
      size,
      size,
    );
  } else {
    const gradient = context.createRadialGradient(
      weaponInfo.muzzleX,
      weaponInfo.muzzleY,
      0,
      weaponInfo.muzzleX,
      weaponInfo.muzzleY,
      size / 2,
    );

    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, config.color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(weaponInfo.muzzleX, weaponInfo.muzzleY, size / 2, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function renderScreenEffects(
  context: CanvasRenderingContext2D,
  options: RenderWorldOptions,
  weaponInfo: WeaponRenderInfo | null,
): void {
  if (!weaponInfo) {
    return;
  }

  for (const effect of getActiveEffects()) {
    if (effect.type === "muzzle-flash") {
      renderMuzzleFlash(context, effect, options, weaponInfo);
    }
  }
}

export function renderWorld(
  context: CanvasRenderingContext2D,
  world: World,
  options: RenderWorldOptions,
): void {
  const { canvas } = context;
  const width = canvas.width;
  const height = canvas.height;
  const buffers = getRenderBuffers(context, width, height);
  const zBuffer = buffers.zBuffer;
  const textures = getTextureSet(world.floor);
  const shake = getCameraShake(options.now);

  context.save();
  context.translate(shake.x, shake.y);
  context.fillStyle = "black";
  context.fillRect(-24, -24, width + 48, height + 48);

  try {
    if (width <= 0 || height <= 0) {
      return;
    }

    renderFloorAndCeiling(context, world, textures, buffers);

    for (let screenX = 0; screenX < width; screenX += 1) {
      const hit = castRay(world, screenX, width);
      const lineHeight = Math.floor(height / hit.distance);
      zBuffer[screenX] = hit.distance;
      const unclampedStart = Math.floor(height / 2 - lineHeight / 2 + world.lookV);
      const unclampedEnd = Math.floor(height / 2 + lineHeight / 2 + world.lookV);
      const drawStart = Math.max(0, unclampedStart);
      const drawEnd = Math.min(height - 1, unclampedEnd);

      if (drawEnd < 0 || drawStart > height - 1) {
        continue;
      }

      renderWallColumn(
        context,
        hit,
        textures,
        screenX,
        lineHeight,
        drawStart,
        drawEnd,
        unclampedStart,
      );
    }

    renderSprites(context, world, zBuffer, options.now, options.imageAssets);
    renderWorldEffects(context, world, options.now, options.imageAssets);
    renderFlamethrowerCone(context, options);
    const weaponInfo = renderWeaponView(context, options);

    renderScreenEffects(context, options, weaponInfo);
  } finally {
    context.restore();
  }
}
