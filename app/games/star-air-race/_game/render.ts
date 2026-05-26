import type {
  EnergyBarrier,
  HazardDefinition,
  RacerState,
  RunState,
  SceneryObject,
  ShortcutDefinition,
  Species,
  Spectator,
  TrackDefinition,
  TrackSection,
  Vec2,
  Zone,
} from "./types";
import {
  getAllBoosters,
  getAllSlowZones,
  getAllHazards,
  getHazardAngle,
  getHazardPosition,
  getMainSegmentWidth,
  getMovingBarrier,
  getRemainingCheckpoints,
  getTrackSection,
  isLaserGateOpen,
  normalizeAngle,
  TOTAL_LAPS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./physics";

type RenderOptions = {
  context: CanvasRenderingContext2D;
  elapsedSeconds: number;
  runState: RunState;
  track: TrackDefinition;
};

type LocalPoint = {
  elevation?: number;
  forward: number;
  side: number;
};

type ProjectedPoint = LocalPoint & {
  scale: number;
  x: number;
  y: number;
};

type ProjectedThing = {
  depth: number;
  draw: () => void;
};

type RoadSegmentInput = {
  a: Vec2;
  b: Vec2;
  kind: "main" | "shortcut";
  section: TrackSection | null;
  sliceCount: number;
  sliceIndex: number;
  width: number;
};

const HORIZON_Y = 270;
const FOCAL_LENGTH = 760;
const CAMERA_HEIGHT = 116;
const NEAR_CLIP = 85;
const ROAD_SLICE_LENGTH = 340;
const SIDE_PROJECTION_SCALE = 0.66;
const ELEVATION_PROJECTION_SCALE = 1.38;

type FrameCamera = {
  cameraHeight: number;
  farClip: number;
  fogDensity: number;
  horizonY: number;
  roll: number;
};

let frameCamera: FrameCamera = {
  cameraHeight: CAMERA_HEIGHT,
  farClip: 3100,
  fogDensity: 0.2,
  horizonY: HORIZON_Y,
  roll: 0,
};

export function renderGame({
  context,
  elapsedSeconds,
  runState,
  track,
}: RenderOptions): void {
  const player = runState.racers.find((racer) => racer.isPlayer);

  context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  if (!player) {
    return;
  }

  const currentSection = getCurrentSection(track, player);
  frameCamera = getFrameCamera(player, currentSection);

  drawSkyAndGround(context, track, elapsedSeconds, player, currentSection);
  drawRoad(context, track, player);

  const things: ProjectedThing[] = [
    ...getZoneDraws(context, player, getAllSlowZones(track), "slow", elapsedSeconds),
    ...getZoneDraws(context, player, getAllBoosters(track), "boost", elapsedSeconds),
    ...getShortcutGateDraws(context, player, track.shortcuts, elapsedSeconds),
    ...getHazardDraws(context, player, track, elapsedSeconds),
    ...getBarrierDraws(context, player, track.barriers, elapsedSeconds),
    ...getSceneryDraws(context, player, track.scenery, elapsedSeconds),
    ...getSpectatorDraws(context, player, track.spectators, elapsedSeconds),
    ...getRacerDraws(context, player, runState.racers, elapsedSeconds),
  ].sort((a, b) => b.depth - a.depth);

  for (const thing of things) {
    thing.draw();
  }

  drawDistanceFog(context, currentSection);
  drawNextCheckpoint(context, player, track);
  drawCockpit(context, player, elapsedSeconds);
  drawHud(context, runState, track, player);
  drawMiniMap(context, runState, track);

  if (runState.phase === "countdown") {
    drawCountdown(context, runState, elapsedSeconds);
  } else if (runState.phase === "finished") {
    drawFinishBanner(context, runState);
  }
}

function drawSkyAndGround(
  context: CanvasRenderingContext2D,
  track: TrackDefinition,
  elapsedSeconds: number,
  player: RacerState,
  section: TrackSection | null,
): void {
  const sky = context.createLinearGradient(0, 0, 0, frameCamera.horizonY + 80);
  const colors = getEnvironmentColors(track, section);

  sky.addColorStop(0, colors[0]);
  sky.addColorStop(0.62, colors[1]);
  sky.addColorStop(1, colors[2]);
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEWPORT_WIDTH, frameCamera.horizonY + 96);

  const ground = context.createLinearGradient(0, frameCamera.horizonY, 0, VIEWPORT_HEIGHT);
  ground.addColorStop(0, colors[3]);
  ground.addColorStop(0.48, "#0f172a");
  ground.addColorStop(1, "#07111f");
  context.fillStyle = ground;
  context.fillRect(0, frameCamera.horizonY, VIEWPORT_WIDTH, VIEWPORT_HEIGHT - frameCamera.horizonY);

  context.save();
  context.globalAlpha = 0.35;
  context.strokeStyle = section?.accentColor ?? "#67e8f9";
  context.lineWidth = 1;

  const drift = (player.x + player.y + elapsedSeconds * Math.max(80, player.speed)) * 0.018;

  for (let index = -18; index <= 18; index += 1) {
    const x = VIEWPORT_WIDTH / 2 + index * 78 + Math.sin(drift + index) * 16;
    context.beginPath();
    context.moveTo(x, frameCamera.horizonY + 8);
    context.lineTo(VIEWPORT_WIDTH / 2 + index * 190, VIEWPORT_HEIGHT);
    context.stroke();
  }

  for (let row = 0; row < 12; row += 1) {
    const y = frameCamera.horizonY + 18 + row * row * 4.3;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(VIEWPORT_WIDTH, y);
    context.stroke();
  }

  context.restore();

  if (section?.kind === "tunnel" || section?.kind === "hangar") {
    drawAtmosphereOverlay(context, section, elapsedSeconds);
  }

  if (section && isEnclosedSkySection(section)) {
    drawCourseCurtains(context, section);
  }

  context.fillStyle = "rgba(255,255,255,0.72)";
  for (let index = 0; index < 80; index += 1) {
    const x = (index * 179) % VIEWPORT_WIDTH;
    const y = 26 + ((index * 73) % Math.max(1, frameCamera.horizonY - 42));
    const radius = 1 + (index % 3) * 0.45;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawRoad(
  context: CanvasRenderingContext2D,
  track: TrackDefinition,
  player: RacerState,
): void {
  const mainSegments: RoadSegmentInput[] = track.checkpoints.map((point, index) => ({
    a: point,
    b: track.checkpoints[(index + 1) % track.checkpoints.length],
    kind: "main" as const,
    section: getTrackSection(track, index),
    sliceCount: 1,
    sliceIndex: 0,
    width: getMainSegmentWidth(track, index),
  }));
  const shortcutSegments = track.shortcuts.flatMap((shortcut) =>
    shortcut.path.slice(0, -1).map((point, index) => ({
      a: point,
      b: shortcut.path[index + 1],
      kind: "shortcut" as const,
      section: null,
      sliceCount: 1,
      sliceIndex: 0,
      width: shortcut.width,
    })),
  );
  const segments = [...mainSegments, ...shortcutSegments]
    .flatMap(sliceRoadSegment)
    .map((segment) =>
      projectRoadSegment(
        player,
        segment.a,
        segment.b,
        segment.width,
        segment.kind,
        segment.section,
        segment.sliceIndex,
        segment.sliceCount,
      ),
    )
    .filter((segment): segment is NonNullable<typeof segment> => segment !== null)
    .sort((a, b) => b.depth - a.depth);

  for (const segment of segments) {
    context.save();
    const palette = getRoadPalette(segment);

    context.fillStyle = palette.road;
    context.strokeStyle =
      segment.kind === "shortcut" ? "rgba(125,211,252,0.72)" : palette.edge;
    context.lineWidth = Math.max(1, 4 * segment.nearScale);
    context.globalAlpha = 0.42;
    context.fillStyle = "rgba(2,6,23,0.55)";
    context.beginPath();
    context.moveTo(segment.leftFar.x, segment.leftFar.y + 11 * segment.farScale);
    context.lineTo(segment.rightFar.x, segment.rightFar.y + 11 * segment.farScale);
    context.lineTo(segment.rightNear.x, segment.rightNear.y + 18 * segment.nearScale);
    context.lineTo(segment.leftNear.x, segment.leftNear.y + 18 * segment.nearScale);
    context.closePath();
    context.fill();

    context.globalAlpha = 1;
    drawRoadThickness(context, segment, palette.edge);

    context.fillStyle = palette.road;
    context.beginPath();
    context.moveTo(segment.leftFar.x, segment.leftFar.y);
    context.lineTo(segment.rightFar.x, segment.rightFar.y);
    context.lineTo(segment.rightNear.x, segment.rightNear.y);
    context.lineTo(segment.leftNear.x, segment.leftNear.y);
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle =
      segment.kind === "shortcut" ? "rgba(250,204,21,0.34)" : palette.center;
    context.lineWidth = Math.max(1, (segment.kind === "shortcut" ? 10 : 22) * segment.nearScale);
    context.beginPath();
    context.moveTo(segment.centerFar.x, segment.centerFar.y);
    context.lineTo(segment.centerNear.x, segment.centerNear.y);
    context.stroke();

    context.strokeStyle =
      segment.kind === "shortcut" ? "rgba(34,211,238,0.72)" : palette.stripe;
    context.setLineDash([16 * segment.nearScale, 18 * segment.nearScale]);
    context.lineWidth = Math.max(1, 3 * segment.nearScale);
    context.beginPath();
    context.moveTo(segment.centerFar.x, segment.centerFar.y);
    context.lineTo(segment.centerNear.x, segment.centerNear.y);
    context.stroke();

    drawSectionDetail(context, segment);

    context.restore();
  }
}

function sliceRoadSegment(segment: RoadSegmentInput): RoadSegmentInput[] {
  const length = distance(segment.a, segment.b);
  const sliceCount = Math.max(1, Math.ceil(length / ROAD_SLICE_LENGTH));

  return Array.from({ length: sliceCount }, (_, sliceIndex) => {
    const start = sliceIndex / sliceCount;
    const end = (sliceIndex + 1) / sliceCount;

    return {
      ...segment,
      a: lerpPoint(segment.a, segment.b, start),
      b: lerpPoint(segment.a, segment.b, end),
      sliceCount,
      sliceIndex,
    };
  });
}

function drawRoadThickness(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
  edgeColor: string,
): void {
  const nearDrop = 34 * segment.nearScale;
  const farDrop = 24 * segment.farScale;
  const leftNearBottom = { ...segment.leftNear, y: segment.leftNear.y + nearDrop };
  const leftFarBottom = { ...segment.leftFar, y: segment.leftFar.y + farDrop };
  const rightNearBottom = { ...segment.rightNear, y: segment.rightNear.y + nearDrop };
  const rightFarBottom = { ...segment.rightFar, y: segment.rightFar.y + farDrop };

  context.save();
  context.fillStyle = "rgba(2,6,23,0.64)";
  context.strokeStyle = edgeColor;
  context.globalAlpha = 0.82;

  context.beginPath();
  context.moveTo(segment.leftFar.x, segment.leftFar.y);
  context.lineTo(segment.leftNear.x, segment.leftNear.y);
  context.lineTo(leftNearBottom.x, leftNearBottom.y);
  context.lineTo(leftFarBottom.x, leftFarBottom.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(segment.rightFar.x, segment.rightFar.y);
  context.lineTo(segment.rightNear.x, segment.rightNear.y);
  context.lineTo(rightNearBottom.x, rightNearBottom.y);
  context.lineTo(rightFarBottom.x, rightFarBottom.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.restore();
}

function projectRoadSegment(
  player: RacerState,
  a: Vec2,
  b: Vec2,
  width: number,
  kind: "main" | "shortcut",
  section: TrackSection | null,
  sliceIndex: number,
  sliceCount: number,
) {
  let localA = toCameraLocal(player, a);
  let localB = toCameraLocal(player, b);

  if (
    (localA.forward <= NEAR_CLIP && localB.forward <= NEAR_CLIP) ||
    (localA.forward >= frameCamera.farClip && localB.forward >= frameCamera.farClip)
  ) {
    return null;
  }

  [localA, localB] = clipLocalSegment(localA, localB, NEAR_CLIP, frameCamera.farClip);

  const sideDelta = localB.side - localA.side;
  const forwardDelta = localB.forward - localA.forward;
  const length = Math.hypot(sideDelta, forwardDelta) || 1;
  const perpSide = -forwardDelta / length;
  const perpForward = sideDelta / length;
  const halfWidth = width / 2;
  const elevation = section?.elevation ?? 0;

  const near = localA.forward > localB.forward ? localA : localB;
  const far = localA.forward > localB.forward ? localB : localA;
  const centerNear = projectLocal({ ...near, elevation });
  const centerFar = projectLocal({ ...far, elevation });
  const leftNear = projectLocal({
    elevation,
    forward: near.forward + perpForward * halfWidth,
    side: near.side + perpSide * halfWidth,
  });
  const rightNear = projectLocal({
    elevation,
    forward: near.forward - perpForward * halfWidth,
    side: near.side - perpSide * halfWidth,
  });
  const leftFar = projectLocal({
    elevation,
    forward: far.forward + perpForward * halfWidth,
    side: far.side + perpSide * halfWidth,
  });
  const rightFar = projectLocal({
    elevation,
    forward: far.forward - perpForward * halfWidth,
    side: far.side - perpSide * halfWidth,
  });

  return {
    centerFar,
    centerNear,
    depth: (localA.forward + localB.forward) / 2,
    farScale: Math.max(centerFar.scale, 0.1),
    kind,
    leftFar,
    leftNear,
    nearScale: Math.max(centerNear.scale, 0.18),
    rightFar,
    rightNear,
    section,
    sliceCount,
    sliceIndex,
    width,
  };
}

type ProjectedRoadSegment = NonNullable<ReturnType<typeof projectRoadSegment>>;

function getRoadPalette(segment: ProjectedRoadSegment): {
  center: string;
  edge: string;
  rail: string;
  road: string;
  stripe: string;
} {
  if (segment.kind === "shortcut") {
    return {
      center: "rgba(250,204,21,0.34)",
      edge: "rgba(125,211,252,0.72)",
      rail: "#fef08a",
      road: "#12364d",
      stripe: "rgba(34,211,238,0.72)",
    };
  }

  if (segment.section?.surface === "creep") {
    return {
      center: "rgba(88,28,135,0.58)",
      edge: "rgba(216,180,254,0.5)",
      rail: "#a855f7",
      road: "#44204f",
      stripe: "rgba(240,171,252,0.72)",
    };
  }

  if (segment.section?.surface === "crystal") {
    return {
      center: "rgba(120,113,108,0.36)",
      edge: "rgba(254,240,138,0.62)",
      rail: "#facc15",
      road: "#384150",
      stripe: "rgba(254,249,195,0.82)",
    };
  }

  if (segment.section?.surface === "metal") {
    return {
      center: "rgba(15,23,42,0.68)",
      edge: "rgba(147,197,253,0.5)",
      rail: "#60a5fa",
      road: "#283446",
      stripe: "rgba(191,219,254,0.68)",
    };
  }

  return {
    center: "rgba(15,23,42,0.58)",
    edge: "rgba(226,232,240,0.34)",
    rail: segment.section?.accentColor ?? "#67e8f9",
    road: "#334155",
    stripe: "rgba(248,250,252,0.55)",
  };
}

function drawSectionDetail(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
): void {
  const section = segment.section;

  if (!section && segment.kind !== "shortcut") {
    return;
  }

  const palette = getRoadPalette(segment);

  context.save();
  context.strokeStyle = palette.rail;
  context.globalAlpha = 0.75;
  context.lineWidth = Math.max(1, 5 * segment.nearScale);

  if (segment.kind === "shortcut" || section?.rail !== "none") {
    context.beginPath();
    context.moveTo(segment.leftFar.x, segment.leftFar.y);
    context.lineTo(segment.leftNear.x, segment.leftNear.y);
    context.moveTo(segment.rightFar.x, segment.rightFar.y);
    context.lineTo(segment.rightNear.x, segment.rightNear.y);
    context.stroke();
  }

  if (getSegmentWallHeight(segment) > 0) {
    drawSectionWall(context, segment, "left", palette.rail);
    drawSectionWall(context, segment, "right", palette.rail);
  }

  if (isEnclosedSegment(segment)) {
    drawOverheadShade(context, segment, palette.rail);
    drawTunnelArch(context, segment, palette.rail);
  }

  drawGuardPosts(context, segment, palette.rail);

  if (section?.kind === "creep") {
    drawCreepVeins(context, segment);
  } else if (section?.kind === "reactor") {
    drawWarningChevrons(context, segment);
  } else if (!section || section.kind === "open" || section.kind === "bridge") {
    drawPanelLines(context, segment);
  }

  context.restore();
}

function getSegmentWallHeight(segment: ProjectedRoadSegment): number {
  if (segment.kind === "shortcut") {
    return 150;
  }

  if (!segment.section) {
    return 0;
  }

  if (segment.section.wallHeight > 0) {
    return segment.section.wallHeight;
  }

  if (segment.section.boundary === "wall") {
    return 145;
  }

  return segment.section.boundary === "rail" ? 72 : 0;
}

function isEnclosedSegment(segment: ProjectedRoadSegment): boolean {
  if (segment.kind === "shortcut") {
    return true;
  }

  const section = segment.section;

  return (
    section?.kind === "canyon" ||
    section?.kind === "creep" ||
    section?.kind === "hangar" ||
    section?.kind === "reactor" ||
    section?.kind === "tunnel" ||
    section?.kind === "warp" ||
    (section?.ceilingHeight ?? 0) > 0
  );
}

function drawOverheadShade(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
  color: string,
): void {
  const height = getSegmentWallHeight(segment);

  if (height <= 0) {
    return;
  }

  const ceilingHeight =
    segment.section?.ceilingHeight ?? (segment.kind === "shortcut" ? 170 : 0);
  const nearLift = (height + ceilingHeight * 0.52) * segment.nearScale * 0.78;
  const farLift = (height + ceilingHeight * 0.52) * segment.farScale * 0.78;
  const leftNearTop = { ...segment.leftNear, y: segment.leftNear.y - nearLift };
  const rightNearTop = { ...segment.rightNear, y: segment.rightNear.y - nearLift };
  const leftFarTop = { ...segment.leftFar, y: segment.leftFar.y - farLift };
  const rightFarTop = { ...segment.rightFar, y: segment.rightFar.y - farLift };

  context.save();
  context.fillStyle = "rgba(2,6,23,0.48)";
  context.strokeStyle = color;
  context.globalAlpha = segment.kind === "shortcut" ? 0.72 : 0.58;
  context.beginPath();
  context.moveTo(leftFarTop.x, leftFarTop.y);
  context.lineTo(rightFarTop.x, rightFarTop.y);
  context.lineTo(rightNearTop.x, rightNearTop.y);
  context.lineTo(leftNearTop.x, leftNearTop.y);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.46;
  context.lineWidth = Math.max(1, 3 * segment.nearScale);
  context.beginPath();
  context.moveTo(leftNearTop.x, leftNearTop.y);
  context.lineTo(rightNearTop.x, rightNearTop.y);
  context.stroke();
  context.restore();
}

function drawGuardPosts(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
  color: string,
): void {
  if (segment.sliceIndex % 2 !== 0) {
    return;
  }

  const wallHeight = getSegmentWallHeight(segment);
  const postHeight = Math.max(52, wallHeight * 0.58);

  for (const base of [segment.leftNear, segment.rightNear]) {
    const top = { ...base, y: base.y - postHeight * base.scale };

    context.strokeStyle = "rgba(2,6,23,0.7)";
    context.lineWidth = Math.max(2, 8 * base.scale);
    context.beginPath();
    context.moveTo(base.x, base.y);
    context.lineTo(top.x, top.y);
    context.stroke();

    context.strokeStyle = color;
    context.lineWidth = Math.max(1, 3 * base.scale);
    context.beginPath();
    context.moveTo(base.x, base.y);
    context.lineTo(top.x, top.y);
    context.stroke();
  }
}

function drawSectionWall(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
  side: "left" | "right",
  color: string,
): void {
  const nearBase = side === "left" ? segment.leftNear : segment.rightNear;
  const farBase = side === "left" ? segment.leftFar : segment.rightFar;
  const height = getSegmentWallHeight(segment);
  const nearTop = { ...nearBase, y: nearBase.y - height * nearBase.scale * 0.78 };
  const farTop = { ...farBase, y: farBase.y - height * farBase.scale * 0.78 };
  const capDirection = side === "left" ? 1 : -1;
  const nearCap = {
    x: nearTop.x + capDirection * 18 * nearBase.scale,
    y: nearTop.y - 10 * nearBase.scale,
  };
  const farCap = {
    x: farTop.x + capDirection * 14 * farBase.scale,
    y: farTop.y - 8 * farBase.scale,
  };

  context.fillStyle = side === "left" ? "rgba(8,13,29,0.78)" : "rgba(15,23,42,0.82)";
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(farBase.x, farBase.y);
  context.lineTo(nearBase.x, nearBase.y);
  context.lineTo(nearTop.x, nearTop.y);
  context.lineTo(farTop.x, farTop.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = side === "left" ? "rgba(51,65,85,0.5)" : "rgba(71,85,105,0.45)";
  context.strokeStyle = "rgba(226,232,240,0.18)";
  context.beginPath();
  context.moveTo(farTop.x, farTop.y);
  context.lineTo(nearTop.x, nearTop.y);
  context.lineTo(nearCap.x, nearCap.y);
  context.lineTo(farCap.x, farCap.y);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = color;
  context.globalAlpha = 0.56;
  context.lineWidth = Math.max(1, 2.5 * segment.nearScale);
  context.beginPath();
  context.moveTo(farCap.x, farCap.y);
  context.lineTo(nearCap.x, nearCap.y);
  context.stroke();
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.lineWidth = Math.max(1, 2 * segment.nearScale);
  context.beginPath();
  context.moveTo(nearBase.x, nearBase.y);
  context.lineTo(nearTop.x, nearTop.y);
  context.stroke();
}

function drawTunnelArch(
  context: CanvasRenderingContext2D,
  segment: ProjectedRoadSegment,
  color: string,
): void {
  const archHeight = getSegmentWallHeight(segment) * segment.nearScale * 0.95;
  const ceilingHeight = (segment.section?.ceilingHeight ?? 0) * segment.nearScale * 0.72;

  context.strokeStyle = color;
  context.globalAlpha = 0.54;
  context.lineWidth = Math.max(1, 4 * segment.nearScale);
  context.beginPath();
  context.moveTo(segment.leftNear.x, segment.leftNear.y - 4);
  context.quadraticCurveTo(
    segment.centerNear.x,
    segment.centerNear.y - archHeight,
    segment.rightNear.x,
    segment.rightNear.y - 4,
  );
  context.stroke();

  if (ceilingHeight > 0) {
    context.fillStyle = "rgba(2,6,23,0.38)";
    context.beginPath();
    context.moveTo(segment.leftNear.x, segment.leftNear.y - 4);
    context.quadraticCurveTo(
      segment.centerNear.x,
      segment.centerNear.y - archHeight - ceilingHeight,
      segment.rightNear.x,
      segment.rightNear.y - 4,
    );
    context.lineTo(segment.rightNear.x, 0);
    context.lineTo(segment.leftNear.x, 0);
    context.closePath();
    context.fill();
  }
}

function drawCreepVeins(context: CanvasRenderingContext2D, segment: ProjectedRoadSegment): void {
  context.strokeStyle = "rgba(240,171,252,0.56)";
  context.lineWidth = Math.max(1, 2 * segment.nearScale);
  for (let index = -1; index <= 1; index += 1) {
    context.beginPath();
    context.moveTo(
      segment.centerFar.x + index * 14 * segment.farScale,
      segment.centerFar.y + Math.sin(index) * 6,
    );
    context.quadraticCurveTo(
      segment.centerNear.x + index * 42 * segment.nearScale,
      (segment.centerFar.y + segment.centerNear.y) / 2,
      segment.centerNear.x + index * 28 * segment.nearScale,
      segment.centerNear.y,
    );
    context.stroke();
  }
}

function drawWarningChevrons(context: CanvasRenderingContext2D, segment: ProjectedRoadSegment): void {
  context.strokeStyle = "rgba(251,146,60,0.75)";
  context.lineWidth = Math.max(1, 3 * segment.nearScale);
  context.beginPath();
  context.moveTo(segment.centerNear.x - 26 * segment.nearScale, segment.centerNear.y - 4);
  context.lineTo(segment.centerNear.x, segment.centerNear.y - 18 * segment.nearScale);
  context.lineTo(segment.centerNear.x + 26 * segment.nearScale, segment.centerNear.y - 4);
  context.stroke();
}

function drawPanelLines(context: CanvasRenderingContext2D, segment: ProjectedRoadSegment): void {
  context.strokeStyle = "rgba(226,232,240,0.22)";
  context.lineWidth = Math.max(1, 2 * segment.nearScale);
  context.beginPath();
  context.moveTo(
    (segment.leftFar.x + segment.centerFar.x) / 2,
    (segment.leftFar.y + segment.centerFar.y) / 2,
  );
  context.lineTo(
    (segment.leftNear.x + segment.centerNear.x) / 2,
    (segment.leftNear.y + segment.centerNear.y) / 2,
  );
  context.moveTo(
    (segment.rightFar.x + segment.centerFar.x) / 2,
    (segment.rightFar.y + segment.centerFar.y) / 2,
  );
  context.lineTo(
    (segment.rightNear.x + segment.centerNear.x) / 2,
    (segment.rightNear.y + segment.centerNear.y) / 2,
  );
  context.stroke();
}

function getZoneDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  zones: Zone[],
  kind: "boost" | "slow",
  elapsedSeconds: number,
): ProjectedThing[] {
  return zones
    .map((zone) => {
      const projected = projectPoint(player, zone);

      if (!projected) {
        return null;
      }

      const corners = getZoneCorners(zone)
        .map((corner) => projectPoint(player, corner))
        .filter((corner): corner is ProjectedPoint => corner !== null);

      if (corners.length < 4) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => {
          context.save();
          context.globalAlpha = kind === "boost" ? 0.9 : 0.72;
          context.fillStyle = kind === "boost" ? "#22c55e" : "#a855f7";
          context.strokeStyle = kind === "boost" ? "#bbf7d0" : "#f0abfc";
          context.shadowBlur = kind === "boost" ? 18 : 12;
          context.shadowColor = kind === "boost" ? "#22c55e" : "#a855f7";
          context.beginPath();
          context.moveTo(corners[0].x, corners[0].y);
          context.lineTo(corners[1].x, corners[1].y);
          context.lineTo(corners[2].x, corners[2].y);
          context.lineTo(corners[3].x, corners[3].y);
          context.closePath();
          context.fill();
          context.stroke();

          if (kind === "boost") {
            drawBillboardText(context, "BOOST", projected, elapsedSeconds);
          }

          context.restore();
        },
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getShortcutGateDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  shortcuts: ShortcutDefinition[],
  elapsedSeconds: number,
): ProjectedThing[] {
  return shortcuts
    .map((shortcut) => {
      const projected = projectPoint(player, shortcut.gate);

      if (!projected) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => {
          const width = clamp(projected.scale * 62, 22, 138);
          const height = clamp(projected.scale * 42, 16, 92);
          const depth = clamp(projected.scale * 22, 5, 18);

          context.save();
          context.translate(projected.x, projected.y - height * 0.6);
          context.globalAlpha = 0.86 + Math.sin(elapsedSeconds * 5) * 0.08;

          context.fillStyle = "rgba(2,6,23,0.66)";
          drawPolygon(context, [
            { x: -width / 2, y: -height / 2 },
            { x: -width / 2 - depth, y: -height / 2 - depth },
            { x: -width / 2 - depth, y: height / 2 - depth * 0.2 },
            { x: -width / 2, y: height / 2 },
          ]);
          context.fill();
          drawPolygon(context, [
            { x: width / 2, y: -height / 2 },
            { x: width / 2 + depth, y: -height / 2 - depth },
            { x: width / 2 + depth, y: height / 2 - depth * 0.2 },
            { x: width / 2, y: height / 2 },
          ]);
          context.fill();

          context.strokeStyle = "#fef08a";
          context.fillStyle = "rgba(8,47,73,0.72)";
          context.lineWidth = 3;
          roundedRect(context, -width / 2, -height / 2, width, height, 8);
          context.fill();
          context.stroke();

          context.fillStyle = "rgba(254,240,138,0.34)";
          drawPolygon(context, [
            { x: -width / 2, y: -height / 2 },
            { x: width / 2, y: -height / 2 },
            { x: width / 2 + depth, y: -height / 2 - depth },
            { x: -width / 2 - depth, y: -height / 2 - depth },
          ]);
          context.fill();

          context.textAlign = "center";
          context.fillStyle = "#fef9c3";
          context.font = `900 ${clamp(projected.scale * 14, 8, 17)}px Pretendard, sans-serif`;
          context.fillText("SHORTCUT", 0, 4);
          context.restore();
        },
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getHazardDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): ProjectedThing[] {
  return getAllHazards(track)
    .map((hazard) => {
      const position = getHazardPosition(hazard, elapsedSeconds);
      const projected = projectPoint(player, position);

      if (!projected) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => drawHazard(context, hazard, projected, elapsedSeconds),
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getBarrierDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  barriers: EnergyBarrier[],
  elapsedSeconds: number,
): ProjectedThing[] {
  return barriers
    .map((barrier) => {
      const movingBarrier = getMovingBarrier(barrier, elapsedSeconds);
      const projected = projectPoint(player, movingBarrier);

      if (!projected) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => drawEnergyBarrier(context, projected, movingBarrier),
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getSceneryDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  scenery: SceneryObject[],
  elapsedSeconds: number,
): ProjectedThing[] {
  return scenery
    .map((item) => {
      const projected = projectPoint(player, item);

      if (!projected || projected.forward < 140) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => drawSceneryObject(context, item, projected, elapsedSeconds),
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getSpectatorDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  spectators: Spectator[],
  elapsedSeconds: number,
): ProjectedThing[] {
  return spectators
    .map((spectator) => {
      const projected = projectPoint(player, spectator);

      if (!projected || projected.forward < 160) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => {
          const size = clamp(projected.scale * 22, 8, 60);
          const bounce =
            spectator.action === "jump"
              ? Math.abs(Math.sin(elapsedSeconds * 5 + spectator.phase)) * -size * 0.16
              : 0;
          const wave = Math.sin(elapsedSeconds * 6 + spectator.phase);

          context.save();
          context.translate(projected.x, projected.y + bounce);
          context.scale(size / 22, size / 22);
          drawSpectatorUnit(context, spectator.species, spectator.action, wave);
          context.restore();
        },
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function getRacerDraws(
  context: CanvasRenderingContext2D,
  player: RacerState,
  racers: RacerState[],
  elapsedSeconds: number,
): ProjectedThing[] {
  return racers
    .filter((racer) => !racer.isPlayer)
    .map((racer) => {
      const projected = projectPoint(player, racer);

      if (!projected) {
        return null;
      }

      return {
        depth: projected.forward,
        draw: () => {
          const size = clamp(projected.scale * 24, 10, 86);
          const viewYaw = normalizeAngle(racer.angle - player.angle);
          const hoverLift = clamp(racer.hoverHeight * projected.scale * 0.46, 0, 32);
          context.save();
          context.translate(projected.x, projected.y - size * 0.45 - hoverLift);
          context.rotate(viewYaw * 0.22);
          context.scale(size / 28, size / 28);
          context.shadowBlur = racer.boostTimer > 0 ? 22 : 12;
          context.shadowColor = racer.boostTimer > 0 ? "#fef08a" : racer.color;
          drawOpponentCraft(context, racer, elapsedSeconds, viewYaw);
          context.restore();
        },
      };
    })
    .filter((thing): thing is ProjectedThing => thing !== null);
}

function drawEnergyBarrier(
  context: CanvasRenderingContext2D,
  projected: ProjectedPoint,
  barrier: EnergyBarrier,
): void {
  const width = clamp(barrier.width * projected.scale * 1.6, 12, 160);
  const height = clamp(barrier.height * projected.scale * 1.35, 36, 360);
  const depth = clamp(projected.scale * 34, 6, 28);

  context.save();
  context.translate(projected.x, projected.y - height * 0.52);
  context.rotate(Math.sin(barrier.angle) * 0.08);
  context.shadowBlur = 24;
  context.shadowColor = "#38bdf8";

  context.fillStyle = "rgba(8,47,73,0.58)";
  drawPolygon(context, [
    { x: -width / 2, y: -height / 2 },
    { x: -width / 2 - depth, y: -height / 2 - depth * 0.45 },
    { x: -width / 2 - depth, y: height / 2 - depth * 0.12 },
    { x: -width / 2, y: height / 2 },
  ]);
  context.fill();

  drawPolygon(context, [
    { x: width / 2, y: -height / 2 },
    { x: width / 2 + depth, y: -height / 2 - depth * 0.45 },
    { x: width / 2 + depth, y: height / 2 - depth * 0.12 },
    { x: width / 2, y: height / 2 },
  ]);
  context.fill();

  context.fillStyle = "rgba(14, 165, 233, 0.54)";
  context.strokeStyle = "#cffafe";
  roundedRect(context, -width / 2, -height / 2, width, height, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "rgba(186,230,253,0.52)";
  drawPolygon(context, [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2 + depth, y: -height / 2 - depth * 0.45 },
    { x: -width / 2 - depth, y: -height / 2 - depth * 0.45 },
  ]);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.72)";
  for (let y = -height / 2 + 18; y < height / 2 - 8; y += 28) {
    context.fillRect(-width / 2 + 4, y, width - 8, 4);
  }

  context.strokeStyle = "rgba(207,250,254,0.92)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-width / 2 - depth, -height / 2 - depth * 0.45);
  context.lineTo(-width / 2 - depth, height / 2 - depth * 0.12);
  context.moveTo(width / 2 + depth, -height / 2 - depth * 0.45);
  context.lineTo(width / 2 + depth, height / 2 - depth * 0.12);
  context.stroke();

  context.restore();
}

function drawSceneryObject(
  context: CanvasRenderingContext2D,
  item: SceneryObject,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const size = clamp(projected.scale * 46 * item.scale, 10, 180);
  const pulse = 0.75 + Math.sin(elapsedSeconds * 3 + (item.phase ?? 0)) * 0.15;

  context.save();
  context.translate(projected.x, projected.y - size * 0.55);
  context.scale(size / 48, size / 48);

  if (item.kind === "terranTower") {
    drawTerranTower(context, pulse);
  } else if (item.kind === "hangarWall") {
    drawHangarWall(context);
  } else if (item.kind === "warpCrystal") {
    drawWarpCrystal(context, pulse);
  } else if (item.kind === "pylon") {
    drawPylon(context, pulse);
  } else if (item.kind === "energyRing") {
    drawEnergyRing(context, pulse, elapsedSeconds);
  } else if (item.kind === "creepColumn") {
    drawCreepColumn(context, pulse);
  } else if (item.kind === "zergSpire") {
    drawZergSpire(context, pulse);
  } else if (item.kind === "reactorCore") {
    drawReactorCore(context, pulse, elapsedSeconds);
  } else if (item.kind === "neonSign") {
    drawNeonSign(context, pulse);
  } else {
    drawAsteroid(context, pulse);
  }

  context.restore();
}

function drawTerranTower(context: CanvasRenderingContext2D, pulse: number): void {
  context.fillStyle = "#334155";
  context.strokeStyle = "#93c5fd";
  roundedRect(context, -13, -48, 26, 88, 4);
  context.fill();
  context.stroke();
  context.fillStyle = "#60a5fa";
  context.globalAlpha = pulse;
  context.fillRect(-9, -38, 18, 8);
  context.fillRect(-9, -18, 18, 8);
  context.globalAlpha = 1;
  context.fillStyle = "#64748b";
  context.fillRect(-26, 22, 52, 14);
}

function drawHangarWall(context: CanvasRenderingContext2D): void {
  context.fillStyle = "rgba(30,41,59,0.9)";
  context.strokeStyle = "#bfdbfe";
  roundedRect(context, -44, -38, 88, 76, 5);
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(147,197,253,0.6)";
  for (let index = -1; index <= 1; index += 1) {
    context.beginPath();
    context.moveTo(index * 24, -34);
    context.lineTo(index * 24, 34);
    context.stroke();
  }
}

function drawWarpCrystal(context: CanvasRenderingContext2D, pulse: number): void {
  context.shadowBlur = 24;
  context.shadowColor = "#facc15";
  context.fillStyle = "#facc15";
  context.strokeStyle = "#fef9c3";
  context.beginPath();
  context.moveTo(0, -54);
  context.lineTo(24, -8);
  context.lineTo(10, 40);
  context.lineTo(-14, 44);
  context.lineTo(-26, -6);
  context.closePath();
  context.fill();
  context.stroke();
  context.globalAlpha = pulse;
  context.fillStyle = "#fff7ed";
  context.fillRect(-4, -26, 8, 42);
}

function drawPylon(context: CanvasRenderingContext2D, pulse: number): void {
  context.shadowBlur = 22;
  context.shadowColor = "#fde68a";
  context.strokeStyle = "#fef3c7";
  context.fillStyle = "#d97706";
  context.beginPath();
  context.moveTo(0, -44);
  context.lineTo(30, 8);
  context.lineTo(0, 42);
  context.lineTo(-30, 8);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = `rgba(103,232,249,${pulse})`;
  context.beginPath();
  context.arc(0, 6, 12, 0, Math.PI * 2);
  context.fill();
}

function drawEnergyRing(
  context: CanvasRenderingContext2D,
  pulse: number,
  elapsedSeconds: number,
): void {
  context.rotate(elapsedSeconds * 0.35);
  context.strokeStyle = `rgba(250,204,21,${pulse})`;
  context.shadowBlur = 20;
  context.shadowColor = "#facc15";
  context.lineWidth = 5;
  context.beginPath();
  context.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "rgba(103,232,249,0.72)";
  context.beginPath();
  context.ellipse(0, 0, 26, 36, Math.PI / 3, 0, Math.PI * 2);
  context.stroke();
}

function drawCreepColumn(context: CanvasRenderingContext2D, pulse: number): void {
  context.fillStyle = "#581c87";
  context.strokeStyle = "#d8b4fe";
  context.shadowBlur = 16;
  context.shadowColor = "#a855f7";
  context.beginPath();
  context.ellipse(0, -6, 18, 48, 0.1, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = `rgba(34,197,94,${pulse})`;
  context.beginPath();
  context.arc(7, -18, 5, 0, Math.PI * 2);
  context.arc(-5, 8, 4, 0, Math.PI * 2);
  context.fill();
}

function drawZergSpire(context: CanvasRenderingContext2D, pulse: number): void {
  context.fillStyle = "#6b21a8";
  context.strokeStyle = "#f0abfc";
  context.beginPath();
  context.moveTo(0, -58);
  context.bezierCurveTo(36, -20, 20, 34, 0, 48);
  context.bezierCurveTo(-24, 22, -34, -26, 0, -58);
  context.fill();
  context.stroke();
  context.strokeStyle = `rgba(34,197,94,${pulse})`;
  context.beginPath();
  context.moveTo(-18, -8);
  context.lineTo(-38, -24);
  context.moveTo(18, 0);
  context.lineTo(42, -12);
  context.stroke();
}

function drawReactorCore(
  context: CanvasRenderingContext2D,
  pulse: number,
  elapsedSeconds: number,
): void {
  context.shadowBlur = 28;
  context.shadowColor = "#fb923c";
  context.fillStyle = "#7c2d12";
  context.strokeStyle = "#fed7aa";
  context.beginPath();
  context.arc(0, 0, 34, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.rotate(elapsedSeconds * 1.2);
  context.strokeStyle = `rgba(251,146,60,${pulse})`;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-44, 0);
  context.lineTo(44, 0);
  context.moveTo(0, -44);
  context.lineTo(0, 44);
  context.stroke();
}

function drawNeonSign(context: CanvasRenderingContext2D, pulse: number): void {
  context.shadowBlur = 18;
  context.shadowColor = "#22d3ee";
  context.fillStyle = "rgba(8,47,73,0.9)";
  context.strokeStyle = "#fef08a";
  roundedRect(context, -42, -18, 84, 36, 6);
  context.fill();
  context.stroke();
  context.textAlign = "center";
  context.fillStyle = `rgba(254,240,138,${pulse})`;
  context.font = "900 10px Pretendard, sans-serif";
  context.fillText("SHORTCUT", 0, 4);
}

function drawAsteroid(context: CanvasRenderingContext2D, pulse: number): void {
  context.fillStyle = "#57534e";
  context.strokeStyle = "#d6d3d1";
  context.globalAlpha = pulse;
  context.beginPath();
  context.moveTo(-30, -16);
  context.lineTo(-6, -34);
  context.lineTo(28, -18);
  context.lineTo(36, 12);
  context.lineTo(8, 34);
  context.lineTo(-32, 20);
  context.closePath();
  context.fill();
  context.stroke();
}

function drawHazard(
  context: CanvasRenderingContext2D,
  hazard: HazardDefinition,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  if (hazard.kind === "laserGate") {
    drawLaserGate(context, hazard, projected, elapsedSeconds);
    return;
  }

  if (hazard.kind === "plasmaMine") {
    drawPlasmaMine(context, projected, elapsedSeconds);
    return;
  }

  if (hazard.kind === "gravityWell") {
    drawGravityWell(context, hazard, projected, elapsedSeconds);
    return;
  }

  if (hazard.kind === "crosswind") {
    drawCrosswind(context, hazard, projected, elapsedSeconds);
    return;
  }

  drawRotorArm(context, hazard, projected, elapsedSeconds);
}

function drawLaserGate(
  context: CanvasRenderingContext2D,
  hazard: HazardDefinition,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const open = isLaserGateOpen(hazard, elapsedSeconds);
  const width = clamp((hazard.width ?? 54) * projected.scale * 2.4, 10, 130);
  const height = clamp((hazard.height ?? 460) * projected.scale * 1.35, 42, 360);

  context.save();
  context.translate(projected.x, projected.y - height * 0.52);
  context.rotate(Math.sin(getHazardAngle(hazard, elapsedSeconds)) * 0.08);
  context.globalAlpha = open ? 0.34 : 0.92;
  context.shadowBlur = open ? 8 : 24;
  context.shadowColor = open ? "#67e8f9" : "#fb7185";
  context.fillStyle = open ? "rgba(14,165,233,0.2)" : "rgba(239,68,68,0.58)";
  context.strokeStyle = open ? "#a5f3fc" : "#fecaca";
  roundedRect(context, -width / 2, -height / 2, width, height, 8);
  context.fill();
  context.stroke();
  context.restore();
}

function drawPlasmaMine(
  context: CanvasRenderingContext2D,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const size = clamp(projected.scale * 36, 9, 74);

  context.save();
  context.translate(projected.x, projected.y - size * 0.45);
  context.rotate(elapsedSeconds * 2.8);
  context.shadowBlur = 22;
  context.shadowColor = "#fb7185";
  context.fillStyle = "#be123c";
  context.strokeStyle = "#fecdd3";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, size * 0.42, 0, Math.PI * 2);
  context.fill();
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    context.beginPath();
    context.moveTo(Math.cos(angle) * size * 0.32, Math.sin(angle) * size * 0.32);
    context.lineTo(Math.cos(angle) * size * 0.68, Math.sin(angle) * size * 0.68);
    context.stroke();
  }
  context.restore();
}

function drawGravityWell(
  context: CanvasRenderingContext2D,
  hazard: HazardDefinition,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const radius = clamp((hazard.radius ?? 520) * projected.scale * 0.28, 18, 140);

  context.save();
  context.translate(projected.x, projected.y - radius * 0.24);
  context.rotate(elapsedSeconds * 0.8);
  context.globalAlpha = 0.72;
  context.strokeStyle = "#c084fc";
  context.shadowBlur = 20;
  context.shadowColor = "#a855f7";
  for (let index = 0; index < 3; index += 1) {
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, 0, radius * (0.62 + index * 0.22), radius * 0.28, index * 0.75, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawCrosswind(
  context: CanvasRenderingContext2D,
  hazard: HazardDefinition,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const width = clamp((hazard.width ?? 900) * projected.scale * 0.3, 32, 180);
  const height = clamp((hazard.height ?? 520) * projected.scale * 0.16, 16, 86);
  const sweep = Math.sin(elapsedSeconds * 5 + (hazard.phase ?? 0)) * width * 0.12;

  context.save();
  context.translate(projected.x + sweep, projected.y - height * 0.5);
  context.globalAlpha = 0.52;
  context.fillStyle = "#38bdf8";
  context.strokeStyle = "#bae6fd";
  roundedRect(context, -width / 2, -height / 2, width, height, 10);
  context.fill();
  context.stroke();
  context.fillStyle = "#eff6ff";
  for (let index = -1; index <= 1; index += 1) {
    const x = index * width * 0.24;
    context.beginPath();
    context.moveTo(x - 12, 0);
    context.lineTo(x + 12, -10);
    context.lineTo(x + 12, 10);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawRotorArm(
  context: CanvasRenderingContext2D,
  hazard: HazardDefinition,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  const width = clamp((hazard.height ?? 560) * projected.scale * 0.44, 34, 220);
  const height = clamp((hazard.width ?? 48) * projected.scale * 2, 7, 28);

  context.save();
  context.translate(projected.x, projected.y - height * 1.5);
  context.rotate(getHazardAngle(hazard, elapsedSeconds));
  context.shadowBlur = 22;
  context.shadowColor = "#f97316";
  context.fillStyle = "rgba(249,115,22,0.78)";
  context.strokeStyle = "#fed7aa";
  roundedRect(context, -width / 2, -height / 2, width, height, 8);
  context.fill();
  context.stroke();
  context.restore();
}

function drawBillboardText(
  context: CanvasRenderingContext2D,
  text: string,
  projected: ProjectedPoint,
  elapsedSeconds: number,
): void {
  context.save();
  context.textAlign = "center";
  context.fillStyle = "#ecfdf5";
  context.font = `900 ${clamp(projected.scale * 20, 9, 24)}px Pretendard, sans-serif`;
  context.globalAlpha = 0.76 + Math.sin(elapsedSeconds * 8) * 0.12;
  context.fillText(text, projected.x, projected.y - clamp(projected.scale * 12, 4, 28));
  context.restore();
}

function drawNextCheckpoint(
  context: CanvasRenderingContext2D,
  player: RacerState,
  track: TrackDefinition,
): void {
  const checkpoint = track.checkpoints[player.checkpointIndex];
  const projected = projectPoint(player, checkpoint);

  context.save();
  context.textAlign = "center";
  context.font = "900 14px Pretendard, sans-serif";

  if (projected) {
    context.strokeStyle = "#fef08a";
    context.fillStyle = "rgba(250, 204, 21, 0.18)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(projected.x, projected.y - 18, clamp(projected.scale * 40, 14, 82), 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#fef08a";
    context.fillText("NEXT", projected.x, projected.y - 18);
  } else {
    const local = toCameraLocal(player, checkpoint);
    const direction = local.side >= 0 ? 1 : -1;
    const x = direction > 0 ? VIEWPORT_WIDTH - 80 : 80;
    const y = frameCamera.horizonY + 30;

    context.fillStyle = "#fef08a";
    context.beginPath();
    context.moveTo(x + direction * 24, y);
    context.lineTo(x - direction * 12, y - 18);
    context.lineTo(x - direction * 12, y + 18);
    context.closePath();
    context.fill();
    context.fillText("NEXT", x, y + 42);
  }

  context.restore();
}

export function drawCockpitLegacy(
  context: CanvasRenderingContext2D,
  player: RacerState,
  elapsedSeconds: number,
): void {
  const shake = Math.sin(elapsedSeconds * 20) * Math.min(5, Math.abs(player.speed) / 120);
  const boost = player.boostTimer > 0 || player.driftBoostTimer > 0;

  context.save();
  context.translate(shake * 0.22, Math.sin(elapsedSeconds * 16) * player.suspensionCompression * 7);
  context.rotate(player.roll * 0.08);

  const panel = context.createLinearGradient(0, VIEWPORT_HEIGHT - 170, 0, VIEWPORT_HEIGHT);
  panel.addColorStop(0, "rgba(7, 17, 31, 0)");
  panel.addColorStop(0.34, "rgba(7, 17, 31, 0.72)");
  panel.addColorStop(1, "#020617");
  context.fillStyle = panel;
  context.fillRect(0, VIEWPORT_HEIGHT - 190, VIEWPORT_WIDTH, 190);

  context.strokeStyle = boost ? "#fef08a" : "#38bdf8";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(230, VIEWPORT_HEIGHT);
  context.lineTo(428, VIEWPORT_HEIGHT - 102);
  context.lineTo(VIEWPORT_WIDTH / 2 - 58, VIEWPORT_HEIGHT - 138);
  context.moveTo(VIEWPORT_WIDTH - 230, VIEWPORT_HEIGHT);
  context.lineTo(VIEWPORT_WIDTH - 428, VIEWPORT_HEIGHT - 102);
  context.lineTo(VIEWPORT_WIDTH / 2 + 58, VIEWPORT_HEIGHT - 138);
  context.stroke();

  context.fillStyle = boost ? "rgba(254, 240, 138, 0.52)" : "rgba(56, 189, 248, 0.38)";
  context.beginPath();
  context.moveTo(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 170);
  context.lineTo(VIEWPORT_WIDTH / 2 - 46, VIEWPORT_HEIGHT - 88);
  context.lineTo(VIEWPORT_WIDTH / 2 + 46, VIEWPORT_HEIGHT - 88);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(248,250,252,0.7)";
  context.lineWidth = 2;
  context.beginPath();
  const sightY = frameCamera.horizonY + 72 + player.pitch * 120;
  context.moveTo(VIEWPORT_WIDTH / 2 - 18, sightY);
  context.lineTo(VIEWPORT_WIDTH / 2 + 18, sightY);
  context.moveTo(VIEWPORT_WIDTH / 2, sightY - 18);
  context.lineTo(VIEWPORT_WIDTH / 2, sightY + 18);
  context.stroke();

  context.restore();
}

export function drawHudLegacy(
  context: CanvasRenderingContext2D,
  runState: RunState,
  track: TrackDefinition,
  player: RacerState,
): void {
  const winner = runState.racers.find((racer) => racer.id === runState.winnerId);

  context.save();
  context.fillStyle = "rgba(7, 17, 31, 0.78)";
  roundedRect(context, 18, 18, 332, 118, 12);
  context.fill();
  context.fillStyle = "#f8fafc";
  context.font = "800 22px Pretendard, sans-serif";
  context.fillText("스타 에어 레이스", 36, 52);
  context.font = "600 14px Pretendard, sans-serif";
  context.fillStyle = "#bae6fd";
  context.fillText(track.name, 36, 78);
  context.fillStyle = "#e2e8f0";
  context.fillText(
    `Lap ${Math.min(player.lap + 1, TOTAL_LAPS)} / ${TOTAL_LAPS}  |  Rank ${player.rank}`,
    36,
    104,
  );

  context.fillStyle = "rgba(7, 17, 31, 0.74)";
  roundedRect(context, VIEWPORT_WIDTH - 270, 18, 252, 154, 12);
  context.fill();
  context.fillStyle = "#f8fafc";
  context.font = "800 16px Pretendard, sans-serif";
  context.fillText("순위", VIEWPORT_WIDTH - 250, 48);
  context.font = "600 13px Pretendard, sans-serif";

  [...runState.racers]
    .sort((a, b) => a.rank - b.rank)
    .forEach((racer, index) => {
      context.fillStyle = racer.isPlayer ? "#fef08a" : "#cbd5e1";
      context.fillText(
        `${index + 1}. ${racer.name}  L${Math.min(racer.lap + 1, TOTAL_LAPS)}`,
        VIEWPORT_WIDTH - 250,
        76 + index * 22,
      );
    });

  context.fillStyle = "rgba(7, 17, 31, 0.74)";
  roundedRect(context, 18, VIEWPORT_HEIGHT - 82, 474, 58, 12);
  context.fill();
  context.fillStyle = "#e0f2fe";
  context.font = "800 15px Pretendard, sans-serif";
  context.fillText(
    `속도 ${Math.round(Math.abs(player.speed))}  |  남은 체크포인트 ${getRemainingCheckpoints(
      player,
      track,
    )}`,
    36,
    VIEWPORT_HEIGHT - 47,
  );

  if (winner) {
    context.fillStyle = "#fef08a";
    context.fillText(`우승: ${winner.name}`, 36, VIEWPORT_HEIGHT - 26);
  }

  context.restore();
}

export function drawMiniMapLegacy(
  context: CanvasRenderingContext2D,
  runState: RunState,
  track: TrackDefinition,
): void {
  const width = 218;
  const height = 148;
  const x = VIEWPORT_WIDTH - width - 18;
  const y = VIEWPORT_HEIGHT - height - 22;
  const scale = Math.min((width - 24) / track.worldWidth, (height - 24) / track.worldHeight);
  const offsetX = x + (width - track.worldWidth * scale) / 2;
  const offsetY = y + (height - track.worldHeight * scale) / 2;

  context.save();
  context.fillStyle = "rgba(7, 17, 31, 0.76)";
  roundedRect(context, x, y, width, height, 12);
  context.fill();
  context.strokeStyle = "rgba(125, 211, 252, 0.35)";
  context.stroke();

  context.beginPath();
  track.checkpoints.forEach((point, index) => {
    const px = offsetX + point.x * scale;
    const py = offsetY + point.y * scale;

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  });
  context.closePath();
  context.strokeStyle = "#64748b";
  context.lineWidth = Math.max(2, track.trackWidth * scale);
  context.stroke();

  for (const shortcut of track.shortcuts) {
    context.beginPath();
    shortcut.path.forEach((point, index) => {
      const px = offsetX + point.x * scale;
      const py = offsetY + point.y * scale;

      if (index === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    });
    context.strokeStyle = "#22d3ee";
    context.lineWidth = Math.max(1.5, shortcut.width * scale);
    context.stroke();

    context.fillStyle = "#fef08a";
    context.beginPath();
    context.arc(
      offsetX + shortcut.gate.x * scale,
      offsetY + shortcut.gate.y * scale,
      3,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  for (const hazard of getAllHazards(track)) {
    const point = getHazardPosition(hazard, runState.elapsedSeconds);

    context.fillStyle =
      hazard.kind === "gravityWell"
        ? "#c084fc"
        : hazard.kind === "crosswind"
          ? "#38bdf8"
          : hazard.kind === "laserGate"
            ? "#fb7185"
            : "#f97316";
    context.beginPath();
    context.arc(offsetX + point.x * scale, offsetY + point.y * scale, 2.4, 0, Math.PI * 2);
    context.fill();
  }

  for (const racer of runState.racers) {
    const px = offsetX + racer.x * scale;
    const py = offsetY + racer.y * scale;
    context.fillStyle = racer.isPlayer ? "#ffffff" : racer.color;
    context.beginPath();
    context.arc(px, py, racer.isPlayer ? 4 : 3, 0, Math.PI * 2);
    context.fill();

    if (racer.isPlayer) {
      context.strokeStyle = "#fef08a";
      context.beginPath();
      context.moveTo(px, py);
      context.lineTo(px + Math.cos(racer.angle) * 12, py + Math.sin(racer.angle) * 12);
      context.stroke();
    }
  }

  context.restore();
}

export function drawCountdownLegacy(
  context: CanvasRenderingContext2D,
  runState: RunState,
  elapsedSeconds: number,
): void {
  const remaining = Math.max(0, 3 - Math.floor(elapsedSeconds - runState.phaseStartedAt));
  const text = remaining <= 0 ? "GO!" : String(remaining);

  context.save();
  context.fillStyle = "rgba(7, 17, 31, 0.58)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  context.textAlign = "center";
  context.fillStyle = "#fef08a";
  context.font = "900 72px Pretendard, sans-serif";
  context.fillText(text, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 24);
  context.restore();
}

export function drawFinishBannerLegacy(context: CanvasRenderingContext2D, runState: RunState): void {
  const player = runState.racers.find((racer) => racer.isPlayer);
  const winner = runState.racers.find((racer) => racer.id === runState.winnerId);
  const won = winner?.isPlayer === true;

  context.save();
  context.fillStyle = "rgba(7, 17, 31, 0.58)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  context.fillStyle = "rgba(15, 23, 42, 0.9)";
  roundedRect(context, VIEWPORT_WIDTH / 2 - 270, VIEWPORT_HEIGHT / 2 - 112, 540, 224, 18);
  context.fill();
  context.textAlign = "center";
  context.fillStyle = won ? "#fef08a" : "#bae6fd";
  context.font = "900 36px Pretendard, sans-serif";
  context.fillText("Race Complete!", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 48);
  context.fillStyle = "#f8fafc";
  context.font = "800 22px Pretendard, sans-serif";
  context.fillText(
    `${winner?.name ?? "알 수 없음"} 우승`,
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2 - 6,
  );
  context.fillStyle = "#cbd5e1";
  context.font = "700 15px Pretendard, sans-serif";
  context.fillText(
    `플레이어 최종 순위 ${player?.rank ?? "-"}위`,
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2 + 34,
  );
  context.fillText(
    won ? "3바퀴를 가장 먼저 완주했습니다." : "AI가 먼저 3바퀴를 완주했습니다.",
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2 + 66,
  );
  context.restore();
}

function drawCockpit(
  context: CanvasRenderingContext2D,
  player: RacerState,
  elapsedSeconds: number,
): void {
  const shake = Math.sin(elapsedSeconds * 20) * Math.min(5, Math.abs(player.speed) / 120);
  const boost = player.boostTimer > 0 || player.driftBoostTimer > 0;
  const warning = player.suspensionCompression > 0.58;

  context.save();
  context.translate(shake * 0.22, Math.sin(elapsedSeconds * 16) * player.suspensionCompression * 7);
  context.rotate(player.roll * 0.08);

  const panel = context.createLinearGradient(0, VIEWPORT_HEIGHT - 220, 0, VIEWPORT_HEIGHT);
  panel.addColorStop(0, "rgba(7, 17, 31, 0)");
  panel.addColorStop(0.28, "rgba(7, 17, 31, 0.58)");
  panel.addColorStop(0.68, "rgba(2, 6, 23, 0.92)");
  panel.addColorStop(1, "#020617");
  context.fillStyle = panel;
  context.fillRect(0, VIEWPORT_HEIGHT - 220, VIEWPORT_WIDTH, 220);

  context.fillStyle = "rgba(15,23,42,0.78)";
  context.strokeStyle = boost ? "#fef08a" : "#67e8f9";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, VIEWPORT_HEIGHT);
  context.lineTo(192, VIEWPORT_HEIGHT - 40);
  context.lineTo(390, VIEWPORT_HEIGHT - 126);
  context.lineTo(VIEWPORT_WIDTH / 2 - 68, VIEWPORT_HEIGHT - 154);
  context.lineTo(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 116);
  context.lineTo(VIEWPORT_WIDTH / 2 + 68, VIEWPORT_HEIGHT - 154);
  context.lineTo(VIEWPORT_WIDTH - 390, VIEWPORT_HEIGHT - 126);
  context.lineTo(VIEWPORT_WIDTH - 192, VIEWPORT_HEIGHT - 40);
  context.lineTo(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = boost ? "rgba(254,240,138,0.9)" : "rgba(103,232,249,0.65)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(230, VIEWPORT_HEIGHT);
  context.lineTo(428, VIEWPORT_HEIGHT - 102);
  context.lineTo(VIEWPORT_WIDTH / 2 - 58, VIEWPORT_HEIGHT - 138);
  context.moveTo(VIEWPORT_WIDTH - 230, VIEWPORT_HEIGHT);
  context.lineTo(VIEWPORT_WIDTH - 428, VIEWPORT_HEIGHT - 102);
  context.lineTo(VIEWPORT_WIDTH / 2 + 58, VIEWPORT_HEIGHT - 138);
  context.stroke();

  context.fillStyle = boost ? "rgba(254, 240, 138, 0.5)" : "rgba(56, 189, 248, 0.28)";
  context.beginPath();
  context.moveTo(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 170);
  context.lineTo(VIEWPORT_WIDTH / 2 - 46, VIEWPORT_HEIGHT - 88);
  context.lineTo(VIEWPORT_WIDTH / 2 + 46, VIEWPORT_HEIGHT - 88);
  context.closePath();
  context.fill();

  drawBoostMeter(context, player);

  const sightY = frameCamera.horizonY + 72 + player.pitch * 120;
  context.strokeStyle = "rgba(248,250,252,0.72)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(VIEWPORT_WIDTH / 2 - 28, sightY);
  context.lineTo(VIEWPORT_WIDTH / 2 - 8, sightY);
  context.moveTo(VIEWPORT_WIDTH / 2 + 8, sightY);
  context.lineTo(VIEWPORT_WIDTH / 2 + 28, sightY);
  context.moveTo(VIEWPORT_WIDTH / 2, sightY - 28);
  context.lineTo(VIEWPORT_WIDTH / 2, sightY - 8);
  context.moveTo(VIEWPORT_WIDTH / 2, sightY + 8);
  context.lineTo(VIEWPORT_WIDTH / 2, sightY + 28);
  context.stroke();

  context.strokeStyle = boost ? "rgba(254,240,138,0.42)" : "rgba(103,232,249,0.24)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(VIEWPORT_WIDTH / 2, sightY, 46, 0, Math.PI * 2);
  context.stroke();

  if (warning) {
    context.fillStyle = `rgba(248,113,113,${0.08 + player.suspensionCompression * 0.08})`;
    context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  context.restore();
  drawScanlines(context, elapsedSeconds);
}

function drawHud(
  context: CanvasRenderingContext2D,
  runState: RunState,
  track: TrackDefinition,
  player: RacerState,
): void {
  context.save();
  drawHeaderStrip(context, track, runState);
  drawSpeedGauge(context, player);
  drawLapPips(context, player);
  drawCheckpointReadout(context, player, track);
  drawRankBoard(context, runState);
  context.restore();
}

function drawMiniMap(
  context: CanvasRenderingContext2D,
  runState: RunState,
  track: TrackDefinition,
): void {
  const width = 236;
  const height = 158;
  const x = VIEWPORT_WIDTH - width - 18;
  const y = VIEWPORT_HEIGHT - height - 28;
  const scale = Math.min((width - 24) / track.worldWidth, (height - 24) / track.worldHeight);
  const offsetX = x + (width - track.worldWidth * scale) / 2;
  const offsetY = y + (height - track.worldHeight * scale) / 2;

  context.save();
  context.fillStyle = "rgba(2, 6, 23, 0.82)";
  context.strokeStyle = "rgba(103, 232, 249, 0.34)";
  roundedRect(context, x, y, width, height, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "rgba(15,23,42,0.8)";
  roundedRect(context, x + 8, y + 8, width - 16, height - 16, 6);
  context.fill();

  context.beginPath();
  track.checkpoints.forEach((point, index) => {
    const px = offsetX + point.x * scale;
    const py = offsetY + point.y * scale;

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  });
  context.closePath();
  context.strokeStyle = "rgba(148,163,184,0.42)";
  context.lineWidth = Math.max(2.5, track.trackWidth * scale);
  context.stroke();
  context.strokeStyle = "rgba(226,232,240,0.7)";
  context.lineWidth = 1.4;
  context.stroke();

  for (const shortcut of track.shortcuts) {
    context.beginPath();
    shortcut.path.forEach((point, index) => {
      const px = offsetX + point.x * scale;
      const py = offsetY + point.y * scale;

      if (index === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    });
    context.strokeStyle = "rgba(34,211,238,0.9)";
    context.lineWidth = Math.max(2, shortcut.width * scale);
    context.stroke();

    context.fillStyle = "#fef08a";
    context.beginPath();
    context.arc(
      offsetX + shortcut.gate.x * scale,
      offsetY + shortcut.gate.y * scale,
      3,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  const player = runState.racers.find((racer) => racer.isPlayer);
  if (player) {
    const checkpoint = track.checkpoints[player.checkpointIndex];
    context.strokeStyle = "rgba(254,240,138,0.65)";
    context.lineWidth = 1;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.moveTo(offsetX + player.x * scale, offsetY + player.y * scale);
    context.lineTo(offsetX + checkpoint.x * scale, offsetY + checkpoint.y * scale);
    context.stroke();
    context.setLineDash([]);
  }

  for (const hazard of getAllHazards(track)) {
    const point = getHazardPosition(hazard, runState.elapsedSeconds);

    context.fillStyle =
      hazard.kind === "gravityWell"
        ? "#c084fc"
        : hazard.kind === "crosswind"
          ? "#38bdf8"
          : hazard.kind === "laserGate"
            ? "#fb7185"
            : "#f97316";
    context.beginPath();
    context.arc(offsetX + point.x * scale, offsetY + point.y * scale, 2.4, 0, Math.PI * 2);
    context.fill();
  }

  for (const racer of runState.racers) {
    drawMiniMapRacer(
      context,
      offsetX + racer.x * scale,
      offsetY + racer.y * scale,
      racer.angle,
      racer.isPlayer ? "#ffffff" : racer.color,
    );
  }

  context.fillStyle = "#bae6fd";
  context.font = "800 11px Pretendard, sans-serif";
  context.fillText("TACTICAL MAP", x + 14, y + 22);
  context.restore();
}

function drawCountdown(
  context: CanvasRenderingContext2D,
  runState: RunState,
  elapsedSeconds: number,
): void {
  const remaining = Math.max(0, 3 - Math.floor(elapsedSeconds - runState.phaseStartedAt));
  const text = remaining <= 0 ? "GO!" : String(remaining);

  context.save();
  context.fillStyle = "rgba(2, 6, 23, 0.7)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  context.textAlign = "center";
  context.fillStyle = "rgba(103,232,249,0.18)";
  context.beginPath();
  context.arc(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, 118, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#fef08a";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2, 92, -Math.PI / 2, Math.PI * 1.5);
  context.stroke();
  context.fillStyle = "#fef08a";
  context.font = "900 78px Pretendard, sans-serif";
  context.fillText(text, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 28);
  context.fillStyle = "#bae6fd";
  context.font = "800 14px Pretendard, sans-serif";
  context.fillText("LAUNCH SEQUENCE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 72);
  context.restore();
}

function drawFinishBanner(context: CanvasRenderingContext2D, runState: RunState): void {
  const player = runState.racers.find((racer) => racer.isPlayer);
  const winner = runState.racers.find((racer) => racer.id === runState.winnerId);
  const won = winner?.isPlayer === true;

  context.save();
  context.fillStyle = "rgba(2, 6, 23, 0.72)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  context.fillStyle = "rgba(8, 17, 31, 0.94)";
  context.strokeStyle = won ? "#fef08a" : "#38bdf8";
  context.lineWidth = 2;
  roundedRect(context, VIEWPORT_WIDTH / 2 - 286, VIEWPORT_HEIGHT / 2 - 124, 572, 248, 8);
  context.fill();
  context.stroke();
  context.textAlign = "center";
  context.fillStyle = won ? "#fef08a" : "#bae6fd";
  context.font = "900 34px Pretendard, sans-serif";
  context.fillText("Race Complete!", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 58);
  context.fillStyle = "#f8fafc";
  context.font = "800 22px Pretendard, sans-serif";
  context.fillText(`${winner?.name ?? "기록 없음"} 우승`, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 12);
  context.fillStyle = "#cbd5e1";
  context.font = "700 15px Pretendard, sans-serif";
  context.fillText(`플레이어 최종 순위 ${player?.rank ?? "-"}위`, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 34);
  context.fillText(
    won ? "3바퀴를 가장 먼저 완주했습니다." : "AI가 먼저 3바퀴를 완주했습니다.",
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2 + 66,
  );
  context.restore();
}

function drawHeaderStrip(
  context: CanvasRenderingContext2D,
  track: TrackDefinition,
  runState: RunState,
): void {
  const winner = runState.racers.find((racer) => racer.id === runState.winnerId);

  context.fillStyle = "rgba(2,6,23,0.62)";
  context.fillRect(0, 0, VIEWPORT_WIDTH, 72);
  context.strokeStyle = "rgba(103,232,249,0.35)";
  context.beginPath();
  context.moveTo(0, 72);
  context.lineTo(VIEWPORT_WIDTH, 72);
  context.stroke();

  context.fillStyle = "#f8fafc";
  context.font = "900 22px Pretendard, sans-serif";
  context.fillText("스타 에어 레이스", 24, 34);
  context.fillStyle = "#bae6fd";
  context.font = "800 13px Pretendard, sans-serif";
  context.fillText(track.name, 24, 56);

  if (winner) {
    context.fillStyle = "#fef08a";
    context.textAlign = "right";
    context.fillText(`우승 ${winner.name}`, VIEWPORT_WIDTH - 24, 35);
    context.textAlign = "left";
  }
}

function drawSpeedGauge(context: CanvasRenderingContext2D, player: RacerState): void {
  const x = 100;
  const y = VIEWPORT_HEIGHT - 104;
  const radius = 64;
  const speedRatio = clamp(Math.abs(player.speed) / 820, 0, 1);
  const start = Math.PI * 0.82;
  const end = Math.PI * 2.18;
  const valueEnd = start + (end - start) * speedRatio;
  const gaugeColor =
    player.boostTimer > 0 || player.driftBoostTimer > 0 ? "#fef08a" : "#38bdf8";

  context.save();
  context.fillStyle = "rgba(2,6,23,0.82)";
  context.strokeStyle = "rgba(103,232,249,0.3)";
  roundedRect(context, 24, VIEWPORT_HEIGHT - 182, 154, 154, 8);
  context.fill();
  context.stroke();

  context.lineWidth = 10;
  context.strokeStyle = "rgba(51,65,85,0.9)";
  context.beginPath();
  context.arc(x, y, radius, start, end);
  context.stroke();

  context.strokeStyle = gaugeColor;
  context.shadowBlur = player.boostTimer > 0 ? 18 : 10;
  context.shadowColor = gaugeColor;
  context.beginPath();
  context.arc(x, y, radius, start, valueEnd);
  context.stroke();
  context.shadowBlur = 0;

  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.font = "900 28px Pretendard, sans-serif";
  context.fillText(String(Math.round(Math.abs(player.speed))), x, y + 10);
  context.fillStyle = "#94a3b8";
  context.font = "800 11px Pretendard, sans-serif";
  context.fillText("SPEED", x, y + 34);
  context.restore();
}

function drawLapPips(context: CanvasRenderingContext2D, player: RacerState): void {
  const x = 210;
  const y = VIEWPORT_HEIGHT - 70;

  context.save();
  context.fillStyle = "rgba(2,6,23,0.76)";
  context.strokeStyle = "rgba(250,204,21,0.28)";
  roundedRect(context, x, y - 54, 178, 80, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "#fef3c7";
  context.font = "900 12px Pretendard, sans-serif";
  context.fillText("LAP", x + 18, y - 28);

  for (let index = 0; index < TOTAL_LAPS; index += 1) {
    const active = index <= player.lap;
    context.fillStyle = active ? "#fef08a" : "rgba(148,163,184,0.24)";
    context.strokeStyle = active ? "#fff7ed" : "rgba(148,163,184,0.4)";
    roundedRect(context, x + 18 + index * 48, y - 14, 34, 14, 4);
    context.fill();
    context.stroke();
  }

  context.fillStyle = "#f8fafc";
  context.font = "900 20px Pretendard, sans-serif";
  context.fillText(`${Math.min(player.lap + 1, TOTAL_LAPS)} / ${TOTAL_LAPS}`, x + 106, y - 26);
  context.restore();
}

function drawCheckpointReadout(
  context: CanvasRenderingContext2D,
  player: RacerState,
  track: TrackDefinition,
): void {
  const checkpoint = track.checkpoints[player.checkpointIndex];
  const remaining = getRemainingCheckpoints(player, track);
  const checkpointDistance = Math.round(distance(player, checkpoint));
  const local = toCameraLocal(player, checkpoint);
  const direction = clamp(local.side / 700, -1, 1);
  const x = VIEWPORT_WIDTH / 2 - 150;
  const y = 84;

  context.save();
  context.fillStyle = "rgba(2,6,23,0.62)";
  context.strokeStyle = "rgba(254,240,138,0.32)";
  roundedRect(context, x, y, 300, 54, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "#fef08a";
  context.font = "900 12px Pretendard, sans-serif";
  context.textAlign = "center";
  context.fillText("CHECKPOINT", VIEWPORT_WIDTH / 2, y + 18);

  context.strokeStyle = "rgba(148,163,184,0.4)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(x + 54, y + 36);
  context.lineTo(x + 246, y + 36);
  context.stroke();

  context.strokeStyle = "#fef08a";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(VIEWPORT_WIDTH / 2, y + 36);
  context.lineTo(VIEWPORT_WIDTH / 2 + direction * 92, y + 36);
  context.stroke();

  context.fillStyle = "#e0f2fe";
  context.font = "800 12px Pretendard, sans-serif";
  context.fillText(`${checkpointDistance}m · 남은 체크포인트 ${remaining}`, VIEWPORT_WIDTH / 2, y + 50);
  context.restore();
}

function drawRankBoard(context: CanvasRenderingContext2D, runState: RunState): void {
  const x = VIEWPORT_WIDTH - 236;
  const y = 88;

  context.save();
  context.fillStyle = "rgba(2,6,23,0.72)";
  context.strokeStyle = "rgba(103,232,249,0.28)";
  roundedRect(context, x, y, 214, 132, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "#bae6fd";
  context.font = "900 12px Pretendard, sans-serif";
  context.fillText("순위", x + 16, y + 24);

  [...runState.racers]
    .sort((a, b) => a.rank - b.rank)
    .forEach((racer, index) => {
      const rowY = y + 48 + index * 20;

      context.fillStyle = racer.isPlayer ? "rgba(254,240,138,0.18)" : "rgba(255,255,255,0.04)";
      roundedRect(context, x + 10, rowY - 13, 194, 18, 4);
      context.fill();

      context.fillStyle = racer.color;
      context.beginPath();
      context.arc(x + 24, rowY - 4, 4, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = racer.isPlayer ? "#fef08a" : "#cbd5e1";
      context.font = "800 12px Pretendard, sans-serif";
      context.fillText(`${index + 1}. ${racer.name}`, x + 36, rowY);

      context.fillStyle = "#94a3b8";
      context.textAlign = "right";
      context.fillText(`L${Math.min(racer.lap + 1, TOTAL_LAPS)}`, x + 194, rowY);
      context.textAlign = "left";
    });

  context.restore();
}

function drawBoostMeter(context: CanvasRenderingContext2D, player: RacerState): void {
  const x = VIEWPORT_WIDTH / 2 - 118;
  const y = VIEWPORT_HEIGHT - 68;
  const width = 236;
  const boostRatio = clamp(Math.max(player.boostTimer, player.driftBoostTimer) / 0.9, 0, 1);
  const driftRatio = clamp(player.driftCharge / 1.2, 0, 1);
  const ratio = Math.max(boostRatio, driftRatio);
  const charged = player.isDrifting && driftRatio >= 0.32;
  const activeBoost = boostRatio > 0;

  context.save();
  context.fillStyle = "rgba(2,6,23,0.78)";
  context.strokeStyle = charged ? "rgba(254,240,138,0.72)" : "rgba(103,232,249,0.28)";
  roundedRect(context, x, y, width, 20, 5);
  context.fill();
  context.stroke();

  context.fillStyle = activeBoost
    ? "#fef08a"
    : player.isDrifting
      ? "#67e8f9"
      : "rgba(56,189,248,0.6)";
  roundedRect(
    context,
    x + 4,
    y + 4,
    Math.max(8, (width - 8) * (ratio > 0 ? ratio : 0.18)),
    12,
    4,
  );
  context.fill();

  if (player.isDrifting) {
    context.strokeStyle = "rgba(254,240,138,0.82)";
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(x + 4 + (width - 8) * 0.32, y + 3);
    context.lineTo(x + 4 + (width - 8) * 0.32, y + 17);
    context.stroke();
    context.setLineDash([]);
  }

  context.fillStyle = "#e0f2fe";
  context.textAlign = "center";
  context.font = "900 10px Pretendard, sans-serif";
  context.fillText(player.isDrifting ? "DRIFT CHARGE" : "BOOST", x + width / 2, y - 7);
  context.restore();
}

function drawScanlines(context: CanvasRenderingContext2D, elapsedSeconds: number): void {
  context.save();
  context.globalAlpha = 0.08;
  context.fillStyle = "#bae6fd";

  const offset = Math.floor((elapsedSeconds * 20) % 8);
  for (let y = offset; y < VIEWPORT_HEIGHT; y += 8) {
    context.fillRect(0, y, VIEWPORT_WIDTH, 1);
  }

  context.restore();
}

function drawMiniMapRacer(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = color;
  context.strokeStyle = "rgba(2,6,23,0.85)";
  context.beginPath();
  context.moveTo(7, 0);
  context.lineTo(-5, -4);
  context.lineTo(-3, 0);
  context.lineTo(-5, 4);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawOpponentCraft(
  context: CanvasRenderingContext2D,
  racer: RacerState,
  elapsedSeconds: number,
  viewYaw: number,
): void {
  const yaw = clamp(viewYaw, -1.25, 1.25);
  const skew = yaw * 5.5;
  const boost = racer.boostTimer > 0;
  const pulse = 0.72 + Math.sin(elapsedSeconds * 8 + racer.personality.phase) * 0.12;

  context.save();
  context.fillStyle = "rgba(2,6,23,0.58)";
  context.beginPath();
  context.ellipse(-2 - skew * 0.22, 11, 24, 6, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = boost ? 0.92 : 0.58;
  context.fillStyle = boost ? "#fef08a" : "rgba(125,211,252,0.75)";
  drawPolygon(context, [
    { x: -18, y: -5 },
    { x: -38 - pulse * 9, y: 0 },
    { x: -18, y: 5 },
    { x: -25, y: 0 },
  ]);
  context.fill();
  context.globalAlpha = 1;

  context.transform(1, 0, yaw * 0.08, 0.9, 0, 0);

  if (racer.species === "terran") {
    drawTerranOpponent(context, racer, yaw);
  } else if (racer.species === "zerg") {
    drawZergOpponent(context, racer, elapsedSeconds, yaw);
  } else {
    drawProtossOpponent(context, racer, yaw);
  }

  context.restore();
}

function drawTerranOpponent(
  context: CanvasRenderingContext2D,
  racer: RacerState,
  yaw: number,
): void {
  const sideShift = yaw * 3;

  context.strokeStyle = "rgba(226,232,240,0.82)";
  context.lineWidth = 1.2;

  context.fillStyle = "#334155";
  drawPolygon(context, [
    { x: -13, y: -12 },
    { x: 3 + sideShift, y: -24 },
    { x: 7 + sideShift, y: -11 },
    { x: -5, y: -3 },
  ]);
  context.fill();
  context.stroke();

  drawPolygon(context, [
    { x: -13, y: 12 },
    { x: 3 + sideShift, y: 24 },
    { x: 7 + sideShift, y: 11 },
    { x: -5, y: 3 },
  ]);
  context.fill();
  context.stroke();

  context.fillStyle = "#1e293b";
  drawPolygon(context, [
    { x: -18, y: -6 },
    { x: 6, y: -9 },
    { x: 28, y: 0 },
    { x: 6, y: 9 },
    { x: -18, y: 6 },
    { x: -10, y: 0 },
  ]);
  context.fill();

  context.fillStyle = "#94a3b8";
  drawPolygon(context, [
    { x: -14, y: -8 },
    { x: 9 + sideShift * 0.35, y: -12 },
    { x: 27, y: 0 },
    { x: 9 + sideShift * 0.35, y: 12 },
    { x: -14, y: 8 },
    { x: -6, y: 0 },
  ]);
  context.fill();
  context.stroke();

  context.fillStyle = racer.color;
  drawPolygon(context, [
    { x: 1, y: -5 },
    { x: 13 + sideShift * 0.18, y: -6 },
    { x: 18, y: 0 },
    { x: 13 + sideShift * 0.18, y: 6 },
    { x: 1, y: 5 },
  ]);
  context.fill();

  context.strokeStyle = "rgba(219,234,254,0.7)";
  context.beginPath();
  context.moveTo(-8, -2);
  context.lineTo(18, -1);
  context.moveTo(-8, 2);
  context.lineTo(18, 1);
  context.stroke();
}

function drawZergOpponent(
  context: CanvasRenderingContext2D,
  racer: RacerState,
  elapsedSeconds: number,
  yaw: number,
): void {
  const flap = Math.sin(elapsedSeconds * 12 + racer.personality.phase) * 4;
  const yawLift = yaw * 2;

  context.fillStyle = "rgba(49,18,81,0.9)";
  context.strokeStyle = "rgba(240,171,252,0.78)";
  context.lineWidth = 1.2;

  context.beginPath();
  context.ellipse(-3 - yawLift, -16 - flap, 19, 7, -0.42, 0, Math.PI * 2);
  context.ellipse(-3 + yawLift, 16 + flap, 19, 7, 0.42, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#4c1d95";
  context.beginPath();
  context.ellipse(0, 3, 20, 9, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#9333ea";
  context.beginPath();
  context.ellipse(4, -1, 23, 10, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = racer.color;
  context.beginPath();
  context.ellipse(9, -1, 9, 5, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(134,239,172,0.78)";
  context.beginPath();
  context.moveTo(-18, -5);
  context.quadraticCurveTo(-29, 0, -18, 5);
  context.moveTo(5, -8);
  context.lineTo(19, -4);
  context.moveTo(5, 8);
  context.lineTo(19, 4);
  context.stroke();
}

function drawProtossOpponent(
  context: CanvasRenderingContext2D,
  racer: RacerState,
  yaw: number,
): void {
  const yawOffset = yaw * 4;

  context.strokeStyle = "rgba(254,249,195,0.86)";
  context.lineWidth = 1.2;

  context.fillStyle = "rgba(120,53,15,0.92)";
  drawPolygon(context, [
    { x: -16, y: -10 },
    { x: 9 + yawOffset, y: -20 },
    { x: 0, y: -4 },
    { x: -21, y: 0 },
    { x: 0, y: 4 },
    { x: 9 + yawOffset, y: 20 },
    { x: -16, y: 10 },
  ]);
  context.fill();
  context.stroke();

  context.fillStyle = "#f59e0b";
  drawPolygon(context, [
    { x: 26, y: 0 },
    { x: 2 + yawOffset * 0.25, y: -14 },
    { x: -15, y: 0 },
    { x: 2 + yawOffset * 0.25, y: 14 },
  ]);
  context.fill();
  context.stroke();

  context.fillStyle = "rgba(251,191,36,0.5)";
  drawPolygon(context, [
    { x: 5, y: -12 },
    { x: 21, y: 0 },
    { x: 5, y: 12 },
    { x: 10, y: 0 },
  ]);
  context.fill();

  context.fillStyle = racer.color;
  context.shadowBlur = 10;
  context.shadowColor = racer.color;
  context.beginPath();
  context.arc(3, 0, 6.5, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
}

function drawSpectatorUnit(
  context: CanvasRenderingContext2D,
  species: Species,
  action: Spectator["action"],
  wave: number,
): void {
  if (species === "terran") {
    context.fillStyle = "#2563eb";
    context.strokeStyle = "#bfdbfe";
    roundedRect(context, -8, -10, 16, 20, 4);
    context.fill();
    context.stroke();
    context.fillStyle = "#94a3b8";
    context.fillRect(-12, 4, 24, 8);
  } else if (species === "zerg") {
    context.fillStyle = "#9333ea";
    context.strokeStyle = "#f0abfc";
    context.beginPath();
    context.ellipse(0, 0, 10, 15, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#22c55e";
    context.beginPath();
    context.arc(4, -4, 3, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = "#facc15";
    context.strokeStyle = "#fef9c3";
    context.beginPath();
    context.moveTo(0, -14);
    context.lineTo(12, 4);
    context.lineTo(0, 15);
    context.lineTo(-12, 4);
    context.closePath();
    context.fill();
    context.stroke();
  }

  context.strokeStyle = species === "protoss" ? "#fef08a" : "#e0f2fe";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-7, -2);
  context.lineTo(-16, -8 - wave * 5);
  context.moveTo(7, -2);
  context.lineTo(16, -8 + wave * 5);
  context.stroke();

  if (action === "flag") {
    context.strokeStyle = "#e2e8f0";
    context.beginPath();
    context.moveTo(14, -12);
    context.lineTo(14, -30);
    context.stroke();
    context.fillStyle =
      species === "zerg" ? "#a855f7" : species === "terran" ? "#38bdf8" : "#facc15";
    context.beginPath();
    context.moveTo(14, -30);
    context.lineTo(30, -25 + wave * 2);
    context.lineTo(14, -20);
    context.closePath();
    context.fill();
  }
}

function getCurrentSection(
  track: TrackDefinition,
  player: RacerState,
): TrackSection | null {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < track.checkpoints.length; index += 1) {
    const current = track.checkpoints[index];
    const next = track.checkpoints[(index + 1) % track.checkpoints.length];
    const segmentDistance = distanceToSegment(player, current, next);

    if (segmentDistance < nearestDistance) {
      nearestDistance = segmentDistance;
      nearestIndex = index;
    }
  }

  return getTrackSection(track, nearestIndex);
}

function getFrameCamera(
  player: RacerState,
  section: TrackSection | null,
): FrameCamera {
  const pitchOffset = player.pitch + (section?.cameraPitch ?? 0);
  const enclosed = isEnclosedSkySection(section);
  const horizonY = clamp(
    HORIZON_Y + pitchOffset * 320 - player.hoverHeight * 0.5,
    170,
    380,
  );
  const farClip = clamp(
    (section?.visibility ?? 2600) + (player.boostTimer > 0 ? 260 : 0),
    enclosed ? 850 : 1050,
    enclosed ? 2300 : 2900,
  );

  return {
    cameraHeight:
      CAMERA_HEIGHT +
      player.hoverHeight * 0.72 -
      player.suspensionCompression * 24 +
      (section?.elevation ?? 0) * 0.12,
    farClip,
    fogDensity: (section?.fogDensity ?? 0.24) + (enclosed ? 0.14 : 0),
    horizonY,
    roll: player.roll + (section?.bank ?? 0) * 0.62,
  };
}

function getEnvironmentColors(
  track: TrackDefinition,
  section: TrackSection | null,
): [string, string, string, string] {
  if (section?.kind === "creep") {
    return ["#170820", "#35134d", "#6b216d", "#3b1747"];
  }

  if (section?.kind === "warp" || section?.surface === "crystal") {
    return ["#07111f", "#17324e", "#805c18", "#273648"];
  }

  if (section?.kind === "tunnel" || section?.kind === "hangar") {
    return ["#020617", "#0f172a", "#1e3a5f", "#111827"];
  }

  if (section?.kind === "reactor") {
    return ["#180b08", "#321414", "#7c2d12", "#24110c"];
  }

  return {
    asteroid: ["#12162a", "#241a34", "#553044", "#1e293b"],
    nebula: ["#071229", "#1c1644", "#4c1d56", "#1e1b4b"],
    station: ["#06111f", "#0f2943", "#1e3a5f", "#1e293b"],
  }[track.theme] as [string, string, string, string];
}

function drawAtmosphereOverlay(
  context: CanvasRenderingContext2D,
  section: TrackSection,
  elapsedSeconds: number,
): void {
  context.save();
  context.globalAlpha = section.kind === "hangar" ? 0.34 : 0.26;
  context.strokeStyle = section.accentColor;
  context.lineWidth = 2;

  for (let index = 0; index < 6; index += 1) {
    const x = 80 + index * 190 + Math.sin(elapsedSeconds + index) * 8;
    context.beginPath();
    context.moveTo(x, frameCamera.horizonY - 16);
    context.lineTo(x - 120, VIEWPORT_HEIGHT);
    context.stroke();
    context.beginPath();
    context.moveTo(VIEWPORT_WIDTH - x, frameCamera.horizonY - 16);
    context.lineTo(VIEWPORT_WIDTH - x + 120, VIEWPORT_HEIGHT);
    context.stroke();
  }

  context.restore();
}

function isEnclosedSkySection(section: TrackSection | null): boolean {
  return (
    section?.boundary === "wall" ||
    section?.kind === "canyon" ||
    section?.kind === "creep" ||
    section?.kind === "hangar" ||
    section?.kind === "reactor" ||
    section?.kind === "tunnel"
  );
}

function drawCourseCurtains(
  context: CanvasRenderingContext2D,
  section: TrackSection,
): void {
  const alpha = section.kind === "open" ? 0.16 : 0.34;
  const leftCurtain = context.createLinearGradient(0, 0, VIEWPORT_WIDTH * 0.42, 0);
  const rightCurtain = context.createLinearGradient(VIEWPORT_WIDTH, 0, VIEWPORT_WIDTH * 0.58, 0);
  const color =
    section.surface === "creep"
      ? "58,12,83"
      : section.surface === "crystal"
        ? "68,48,15"
        : "2,6,23";

  leftCurtain.addColorStop(0, `rgba(${color},${alpha + 0.18})`);
  leftCurtain.addColorStop(1, `rgba(${color},0)`);
  rightCurtain.addColorStop(0, `rgba(${color},${alpha + 0.18})`);
  rightCurtain.addColorStop(1, `rgba(${color},0)`);

  context.save();
  context.fillStyle = leftCurtain;
  context.fillRect(0, 0, VIEWPORT_WIDTH * 0.44, VIEWPORT_HEIGHT);
  context.fillStyle = rightCurtain;
  context.fillRect(VIEWPORT_WIDTH * 0.56, 0, VIEWPORT_WIDTH * 0.44, VIEWPORT_HEIGHT);
  context.fillStyle = `rgba(${color},${alpha})`;
  context.fillRect(0, 0, VIEWPORT_WIDTH, Math.max(0, frameCamera.horizonY - 18));
  context.restore();
}

function drawDistanceFog(
  context: CanvasRenderingContext2D,
  section: TrackSection | null,
): void {
  const fogStrength = clamp(frameCamera.fogDensity, 0, 0.8);
  const fogStart = frameCamera.horizonY - 12;
  const fog = context.createLinearGradient(0, fogStart, 0, VIEWPORT_HEIGHT);
  const color =
    section?.surface === "creep"
      ? "58,24,77"
      : section?.surface === "crystal"
        ? "39,54,72"
        : "7,17,31";

  fog.addColorStop(0, `rgba(${color},${0.34 + fogStrength * 0.5})`);
  fog.addColorStop(0.32, `rgba(${color},${0.18 + fogStrength * 0.32})`);
  fog.addColorStop(1, `rgba(${color},0)`);

  context.save();
  context.fillStyle = fog;
  context.fillRect(0, Math.max(0, fogStart), VIEWPORT_WIDTH, VIEWPORT_HEIGHT - fogStart);

  if (section && section.wallHeight > 0) {
    context.fillStyle = `rgba(2,6,23,${0.12 + fogStrength * 0.26})`;
    context.fillRect(0, 0, VIEWPORT_WIDTH, frameCamera.horizonY + 8);
  }

  context.restore();
}

function getZoneCorners(zone: Zone): Vec2[] {
  const angle = zone.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = [
    { x: -zone.width / 2, y: -zone.height / 2 },
    { x: zone.width / 2, y: -zone.height / 2 },
    { x: zone.width / 2, y: zone.height / 2 },
    { x: -zone.width / 2, y: zone.height / 2 },
  ];

  return points.map((point) => ({
    x: zone.x + point.x * cos - point.y * sin,
    y: zone.y + point.x * sin + point.y * cos,
  }));
}

function projectPoint(player: RacerState, point: Vec2): ProjectedPoint | null {
  const local = toCameraLocal(player, point);

  if (local.forward <= NEAR_CLIP || local.forward >= frameCamera.farClip) {
    return null;
  }

  return projectLocal(local);
}

function toCameraLocal(player: RacerState, point: Vec2): LocalPoint {
  const dx = point.x - player.x;
  const dy = point.y - player.y;
  const forwardX = Math.cos(player.angle);
  const forwardY = Math.sin(player.angle);
  const rightX = -Math.sin(player.angle);
  const rightY = Math.cos(player.angle);

  return {
    forward: dx * forwardX + dy * forwardY,
    side: dx * rightX + dy * rightY,
  };
}

function projectLocal(local: LocalPoint): ProjectedPoint {
  const scale = FOCAL_LENGTH / Math.max(NEAR_CLIP, local.forward);
  const elevation = local.elevation ?? 0;
  const rawX = VIEWPORT_WIDTH / 2 + local.side * SIDE_PROJECTION_SCALE * scale;
  const rawY =
    frameCamera.horizonY +
    (frameCamera.cameraHeight - elevation * ELEVATION_PROJECTION_SCALE) * scale;
  const roll = frameCamera.roll * 0.24;
  const dx = rawX - VIEWPORT_WIDTH / 2;
  const dy = rawY - frameCamera.horizonY;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);

  return {
    ...local,
    scale,
    x: VIEWPORT_WIDTH / 2 + dx * cos - dy * sin,
    y: frameCamera.horizonY + dx * sin + dy * cos,
  };
}

function clipLocalSegment(
  a: LocalPoint,
  b: LocalPoint,
  near: number,
  far: number,
): [LocalPoint, LocalPoint] {
  let nextA = { ...a };
  let nextB = { ...b };

  if (nextA.forward < near) {
    nextA = interpolateToForward(nextA, nextB, near);
  }

  if (nextB.forward < near) {
    nextB = interpolateToForward(nextB, nextA, near);
  }

  if (nextA.forward > far) {
    nextA = interpolateToForward(nextA, nextB, far);
  }

  if (nextB.forward > far) {
    nextB = interpolateToForward(nextB, nextA, far);
  }

  return [nextA, nextB];
}

function interpolateToForward(a: LocalPoint, b: LocalPoint, forward: number): LocalPoint {
  const denominator = b.forward - a.forward || 1;
  const t = (forward - a.forward) / denominator;

  return {
    forward,
    side: a.side + (b.side - a.side) * t,
  };
}

function lerpPoint(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
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

function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  const t =
    lengthSquared === 0
      ? 0
      : clamp((apx * abx + apy * aby) / lengthSquared, 0, 1);
  const x = a.x + abx * t;
  const y = a.y + aby * t;

  return Math.hypot(point.x - x, point.y - y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
