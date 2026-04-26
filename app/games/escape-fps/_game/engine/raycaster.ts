import type { RayHit, Vec2, WallSide, World } from "../lib/types";

function getMapValue(world: World, mapX: number, mapY: number): number {
  const row = world.map[mapY];

  if (!row) {
    return 1;
  }

  return row[mapX] ?? 1;
}

export function castRayAtCameraX(world: World, cameraX: number): RayHit {
  const { player } = world;
  const rayDir: Vec2 = {
    x: player.dir.x + player.plane.x * cameraX,
    y: player.dir.y + player.plane.y * cameraX,
  };

  let mapX = Math.floor(player.pos.x);
  let mapY = Math.floor(player.pos.y);

  // DDA needs the distance from one x-side/y-side to the next. A zero ray
  // component means that axis is never crossed, so Infinity keeps it inactive.
  const deltaDistX =
    rayDir.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayDir.x);
  const deltaDistY =
    rayDir.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayDir.y);

  let stepX: -1 | 1;
  let stepY: -1 | 1;
  let sideDistX: number;
  let sideDistY: number;

  if (rayDir.x < 0) {
    stepX = -1;
    sideDistX = (player.pos.x - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - player.pos.x) * deltaDistX;
  }

  if (rayDir.y < 0) {
    stepY = -1;
    sideDistY = (player.pos.y - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - player.pos.y) * deltaDistY;
  }

  let side: WallSide = "northSouth";
  let wallValue = 0;
  const maxSteps = world.map.length + (world.map[0]?.length ?? 0) + 4;
  let steps = 0;

  while (wallValue === 0 && steps < maxSteps) {
    // Step to the next grid boundary. X crossings hit vertical north/south
    // wall faces; Y crossings hit horizontal east/west wall faces.
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = "northSouth";
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = "eastWest";
    }

    wallValue = getMapValue(world, mapX, mapY);
    steps += 1;
  }

  const rawDistance =
    side === "northSouth" ? sideDistX - deltaDistX : sideDistY - deltaDistY;
  const distance = Math.max(rawDistance, 0.0001);
  const wallHitCoord =
    side === "northSouth"
      ? player.pos.y + distance * rayDir.y
      : player.pos.x + distance * rayDir.x;
  const wallX = wallHitCoord - Math.floor(wallHitCoord);

  return {
    cameraX,
    distance,
    mapX,
    mapY,
    rayDir,
    side,
    wallX,
    wallValue,
  };
}

export function castRay(world: World, screenX: number, screenWidth: number): RayHit {
  const cameraX = (2 * screenX) / screenWidth - 1;

  return castRayAtCameraX(world, cameraX);
}
