import { ENEMIES } from "../lib/enemies-config";
import type { Sprite, World } from "../lib/types";
import type { ImageAssets } from "./assets";

function getPickupTextureId(type: string): Sprite["textureId"] {
  return type === "flamethrower" ? 1 : 0;
}

function collectSprites(world: World, now: number): Sprite[] {
  return [
    {
      imageKey: "door-0",
      kind: "door",
      label: "EXIT",
      scale: 1.2,
      textureId: 4,
      x: world.exit.x,
      y: world.exit.y,
      yOffset: 0,
    },
    ...world.pickups
      .filter((pickup) => !pickup.taken)
      .map((pickup): Sprite => ({
        kind: "pickup",
        label: pickup.type === "flamethrower" ? "F" : "R",
        scale: 0.45,
        textureId: getPickupTextureId(pickup.type),
        x: pickup.x,
        y: pickup.y,
      })),
    ...world.impactMarks
      .filter((mark) => mark.removeAt > now)
      .map((mark): Sprite => ({
        kind: "impact",
        removeAt: mark.removeAt,
        scale: 0.12,
        textureId: 2,
        x: mark.x,
        y: mark.y,
      })),
    ...world.healthPickups
      .filter((pickup) => !pickup.taken)
      .map((pickup): Sprite => ({
        kind: "health",
        label: "+",
        scale: 0.35,
        textureId: 3,
        x: pickup.x,
        y: pickup.y,
      })),
    ...world.decorations
      .filter((decoration) => !decoration.broken)
      .map((decoration): Sprite => ({
        decoration,
        imageKey: decoration.imageKey,
        kind: "decoration",
        label: decoration.kind,
        scale: decoration.scale,
        textureId: 5,
        x: decoration.x,
        y: decoration.y,
        yOffset:
          decoration.kind === "nest-pillar" || decoration.kind === "pipe"
            ? 0.18
            : 0.36,
      })),
    ...world.enemies
      .filter((enemy) => enemy.state !== "dead")
      .map((enemy): Sprite => {
        const config = ENEMIES[enemy.type];

        return {
          enemy,
          imageKey: config.spriteImageKey,
          kind: "enemy",
          label: enemy.type.slice(0, 1).toUpperCase(),
          scale: config.scale,
          textureId: 0,
          x: enemy.x,
          y: enemy.y,
          yOffset: config.yOffset,
        };
      }),
  ];
}

function drawDecorationPlaceholder(
  context: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const kind = sprite.decoration?.kind;

  if (kind === "box") {
    context.fillStyle = "rgba(116, 74, 35, 0.96)";
    context.fillRect(x, y + height * 0.05, width, height * 0.9);
    context.strokeStyle = "rgba(38, 21, 9, 0.7)";
    context.lineWidth = 2;
    context.strokeRect(x, y + height * 0.05, width, height * 0.9);
    context.strokeStyle = "rgba(220, 168, 88, 0.45)";
    context.beginPath();
    context.moveTo(x, y + height * 0.5);
    context.lineTo(x + width, y + height * 0.5);
    context.moveTo(x + width * 0.5, y + height * 0.05);
    context.lineTo(x + width * 0.5, y + height * 0.95);
    context.stroke();

    if (sprite.decoration?.dropWeapon) {
      context.fillStyle = "rgba(255, 235, 140, 0.92)";
      context.fillRect(x + width * 0.22, y + height * 0.33, width * 0.56, height * 0.24);
      context.fillStyle = "rgba(35, 24, 10, 0.9)";
      context.font = `${Math.max(9, Math.floor(height * 0.18))}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("SUP", x + width / 2, y + height * 0.45);
    }

    if (sprite.decoration && sprite.decoration.hurtFlashUntil && performance.now() < sprite.decoration.hurtFlashUntil) {
      context.fillStyle = "rgba(255, 255, 255, 0.28)";
      context.fillRect(x, y + height * 0.05, width, height * 0.9);
    }
    return;
  }

  if (kind === "barrel") {
    const gradient = context.createLinearGradient(x, y, x + width, y);

    gradient.addColorStop(0, "rgba(35, 35, 38, 0.96)");
    gradient.addColorStop(0.5, "rgba(115, 105, 82, 0.98)");
    gradient.addColorStop(1, "rgba(35, 35, 38, 0.96)");
    context.fillStyle = gradient;
    context.fillRect(x + width * 0.18, y + height * 0.03, width * 0.64, height * 0.94);
    context.strokeStyle = "rgba(210, 200, 155, 0.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(x + width / 2, y + height * 0.09, width * 0.32, height * 0.08, 0, 0, Math.PI * 2);
    context.ellipse(x + width / 2, y + height * 0.91, width * 0.32, height * 0.08, 0, 0, Math.PI * 2);
    context.stroke();

    if (sprite.decoration?.dropHealth) {
      context.fillStyle = "rgba(70, 230, 125, 0.9)";
      context.beginPath();
      context.arc(x + width / 2, y + height * 0.5, Math.max(4, width * 0.18), 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(240, 255, 240, 0.95)";
      context.fillRect(x + width * 0.46, y + height * 0.36, width * 0.08, height * 0.28);
      context.fillRect(x + width * 0.36, y + height * 0.46, width * 0.28, height * 0.08);
    }

    if (sprite.decoration && sprite.decoration.hurtFlashUntil && performance.now() < sprite.decoration.hurtFlashUntil) {
      context.fillStyle = "rgba(255, 255, 255, 0.25)";
      context.fillRect(x + width * 0.18, y + height * 0.03, width * 0.64, height * 0.94);
    }
    return;
  }

  if (kind === "test-tube" || kind === "lab-panel") {
    context.fillStyle = "rgba(22, 48, 54, 0.95)";
    context.fillRect(x + width * 0.08, y + height * 0.08, width * 0.84, height * 0.84);
    context.strokeStyle = "rgba(130, 245, 210, 0.62)";
    context.lineWidth = 2;
    context.strokeRect(x + width * 0.08, y + height * 0.08, width * 0.84, height * 0.84);

    if (kind === "test-tube") {
      const liquid = context.createLinearGradient(x, y, x, y + height);

      liquid.addColorStop(0, "rgba(210, 255, 245, 0.55)");
      liquid.addColorStop(1, "rgba(42, 245, 150, 0.95)");
      context.fillStyle = liquid;
      context.fillRect(x + width * 0.32, y + height * 0.18, width * 0.36, height * 0.62);
      context.fillStyle = "rgba(120, 255, 195, 0.75)";
      context.beginPath();
      context.arc(x + width / 2, y + height * 0.62, width * 0.14, 0, Math.PI * 2);
      context.fill();
    } else {
      for (let index = 0; index < 3; index += 1) {
        context.fillStyle = index === 1 ? "#8df0d1" : "#f0d56f";
        context.beginPath();
        context.arc(x + width * (0.28 + index * 0.22), y + height * 0.38, Math.max(2, width * 0.06), 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = "rgba(120, 240, 210, 0.36)";
      context.fillRect(x + width * 0.18, y + height * 0.6, width * 0.64, height * 0.12);
    }
    return;
  }

  if (kind === "pipe" || kind === "sewer-grate") {
    context.strokeStyle = "rgba(65, 92, 96, 0.98)";
    context.lineWidth = Math.max(4, width * 0.18);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x + width * 0.22, y + height * 0.18);
    context.lineTo(x + width * 0.22, y + height * 0.82);
    context.lineTo(x + width * 0.8, y + height * 0.82);
    context.stroke();

    if (kind === "sewer-grate") {
      context.fillStyle = "rgba(15, 28, 30, 0.95)";
      context.fillRect(x + width * 0.08, y + height * 0.28, width * 0.84, height * 0.44);
      context.strokeStyle = "rgba(110, 150, 142, 0.85)";
      context.lineWidth = 2;
      for (let index = 0; index < 5; index += 1) {
        const lineX = x + width * (0.18 + index * 0.16);

        context.beginPath();
        context.moveTo(lineX, y + height * 0.3);
        context.lineTo(lineX, y + height * 0.7);
        context.stroke();
      }
    }
    return;
  }

  if (kind === "growth" || kind === "cocoon") {
    const gradient = context.createRadialGradient(
      x + width / 2,
      y + height * 0.55,
      0,
      x + width / 2,
      y + height * 0.55,
      Math.max(width, height) * 0.5,
    );

    gradient.addColorStop(0, kind === "cocoon" ? "rgba(255, 130, 112, 0.96)" : "rgba(180, 42, 58, 0.96)");
    gradient.addColorStop(0.65, "rgba(90, 18, 32, 0.92)");
    gradient.addColorStop(1, "rgba(28, 4, 12, 0.35)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x + width / 2, y + height * 0.56, width * 0.38, height * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255, 135, 125, 0.5)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + width * 0.32, y + height * 0.34);
    context.bezierCurveTo(x + width * 0.46, y + height * 0.54, x + width * 0.42, y + height * 0.72, x + width * 0.66, y + height * 0.82);
    context.stroke();
    return;
  }

  if (kind === "egg" || kind === "nest-pillar") {
    const gradient = context.createRadialGradient(
      x + width * 0.45,
      y + height * 0.38,
      0,
      x + width / 2,
      y + height * 0.55,
      Math.max(width, height) * 0.55,
    );

    gradient.addColorStop(0, "rgba(246, 170, 118, 0.96)");
    gradient.addColorStop(0.55, "rgba(125, 42, 52, 0.96)");
    gradient.addColorStop(1, "rgba(38, 8, 18, 0.58)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(
      x + width / 2,
      y + height * 0.55,
      kind === "egg" ? width * 0.34 : width * 0.28,
      kind === "egg" ? height * 0.42 : height * 0.48,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.strokeStyle = "rgba(255, 195, 145, 0.36)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + width * 0.5, y + height * 0.18);
    context.lineTo(x + width * 0.42, y + height * 0.82);
    context.moveTo(x + width * 0.62, y + height * 0.28);
    context.lineTo(x + width * 0.55, y + height * 0.78);
    context.stroke();
  }
}

function drawSpritePlaceholder(
  context: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (sprite.textureId === 2) {
    context.fillStyle = "rgba(18, 18, 18, 0.9)";
    context.beginPath();
    context.arc(x + width / 2, y + height / 2, Math.max(3, width / 2), 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (sprite.kind === "decoration") {
    drawDecorationPlaceholder(context, sprite, x, y, width, height);
    return;
  }

  if (sprite.kind === "health") {
    const radius = Math.max(4, Math.min(width, height) * 0.5);

    context.fillStyle = "rgba(18, 120, 55, 0.92)";
    context.beginPath();
    context.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(210, 255, 225, 0.8)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "rgba(235, 255, 240, 0.96)";
    context.fillRect(x + width * 0.42, y + height * 0.22, width * 0.16, height * 0.56);
    context.fillRect(x + width * 0.22, y + height * 0.42, width * 0.56, height * 0.16);
    return;
  }

  if (sprite.kind === "door") {
    context.fillStyle = "rgba(20, 70, 42, 0.92)";
    context.fillRect(x, y, width, height);
    context.strokeStyle = "rgba(160, 255, 175, 0.75)";
    context.lineWidth = 3;
    context.strokeRect(x + 2, y + 2, width - 4, height - 4);
    context.fillStyle = "rgba(220, 255, 225, 0.92)";
    context.font = `${Math.max(10, Math.floor(height * 0.18))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("EXIT", x + width / 2, y + height * 0.5);
    return;
  }

  context.fillStyle = sprite.textureId === 0 ? "#777777" : "#9b1f1f";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  context.fillStyle = "white";
  context.font = `${Math.max(12, Math.floor(height * 0.45))}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(sprite.label ?? (sprite.textureId === 0 ? "R" : "F"), x + width / 2, y + height / 2);
}

function drawImageSprite(
  context: CanvasRenderingContext2D,
  sprite: Sprite,
  imageAssets: ImageAssets,
  bounds: {
    drawEndX: number;
    drawEndY: number;
    drawStartX: number;
    drawStartY: number;
    visibleEndX: number;
    visibleStartX: number;
  },
  now: number,
): void {
  const image = sprite.imageKey ? imageAssets[sprite.imageKey] : null;
  const width = bounds.drawEndX - bounds.drawStartX + 1;
  const height = bounds.drawEndY - bounds.drawStartY + 1;

  context.save();
  context.beginPath();
  context.rect(
    bounds.visibleStartX,
    bounds.drawStartY,
    bounds.visibleEndX - bounds.visibleStartX + 1,
    height,
  );
  context.clip();

  if (image) {
    context.drawImage(
      image,
      bounds.drawStartX,
      bounds.drawStartY,
      width,
      height,
    );
  } else if (sprite.kind === "decoration" || sprite.kind === "door") {
    drawSpritePlaceholder(
      context,
      sprite,
      bounds.drawStartX,
      bounds.drawStartY,
      width,
      height,
    );
  } else {
    context.fillStyle = "rgba(95, 40, 48, 0.92)";
    context.fillRect(bounds.drawStartX, bounds.drawStartY, width, height);
    context.strokeStyle = "rgba(255, 255, 255, 0.45)";
    context.lineWidth = 2;
    context.strokeRect(bounds.drawStartX, bounds.drawStartY, width, height);
    context.fillStyle = "white";
    context.font = `${Math.max(12, Math.floor(height * 0.34))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      sprite.label ?? "?",
      bounds.drawStartX + width / 2,
      bounds.drawStartY + height / 2,
    );
  }

  if (sprite.enemy && now < sprite.enemy.hurtFlashUntil) {
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = "rgba(255, 36, 36, 0.55)";
    context.fillRect(bounds.drawStartX, bounds.drawStartY, width, height);
    context.globalCompositeOperation = "source-over";
  }

  context.restore();
}

export function renderSprites(
  context: CanvasRenderingContext2D,
  world: World,
  zBuffer: Float32Array,
  now: number,
  imageAssets: ImageAssets,
): void {
  const { canvas } = context;
  const width = canvas.width;
  const height = canvas.height;
  const { dir, plane, pos } = world.player;
  const sprites = collectSprites(world, now).sort((a, b) => {
    const distanceA = (a.x - pos.x) ** 2 + (a.y - pos.y) ** 2;
    const distanceB = (b.x - pos.x) ** 2 + (b.y - pos.y) ** 2;

    return distanceB - distanceA;
  });

  for (const sprite of sprites) {
    const spriteX = sprite.x - pos.x;
    const spriteY = sprite.y - pos.y;
    const invDet = 1 / (plane.x * dir.y - dir.x * plane.y);
    const transformX = invDet * (dir.y * spriteX - dir.x * spriteY);
    const transformY = invDet * (-plane.y * spriteX + plane.x * spriteY);

    if (transformY <= 0) {
      continue;
    }

    const spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY));
    const spriteHeight = Math.abs(Math.floor((height / transformY) * sprite.scale));
    const spriteWidth = spriteHeight;
    const yOffsetPixels = Math.floor((sprite.yOffset ?? 0) * spriteHeight);
    const drawStartY = Math.max(
      0,
      Math.floor(height / 2 - spriteHeight / 2 + world.lookV + yOffsetPixels),
    );
    const drawEndY = Math.min(
      height - 1,
      Math.floor(height / 2 + spriteHeight / 2 + world.lookV + yOffsetPixels),
    );
    const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteWidth / 2));
    const drawEndX = Math.min(width - 1, Math.floor(spriteScreenX + spriteWidth / 2));
    let visibleStartX = Number.POSITIVE_INFINITY;
    let visibleEndX = Number.NEGATIVE_INFINITY;

    if (drawEndY < drawStartY || drawEndX < drawStartX) {
      continue;
    }

    for (let stripe = drawStartX; stripe <= drawEndX; stripe += 1) {
      if (transformY >= zBuffer[stripe]) {
        continue;
      }

      visibleStartX = Math.min(visibleStartX, stripe);
      visibleEndX = Math.max(visibleEndX, stripe);
    }

    if (!Number.isFinite(visibleStartX) || visibleEndX < visibleStartX) {
      continue;
    }

    if (sprite.kind === "decoration" || sprite.kind === "door" || sprite.kind === "enemy") {
      drawImageSprite(
        context,
        sprite,
        imageAssets,
        {
          drawEndX,
          drawEndY,
          drawStartX,
          drawStartY,
          visibleEndX,
          visibleStartX,
        },
        now,
      );
      continue;
    }

    drawSpritePlaceholder(
      context,
      sprite,
      visibleStartX,
      drawStartY,
      visibleEndX - visibleStartX + 1,
      drawEndY - drawStartY + 1,
    );
  }
}
