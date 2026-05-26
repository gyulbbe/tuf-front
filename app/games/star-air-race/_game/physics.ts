import type {
  EnergyBarrier,
  HazardDefinition,
  InputState,
  RacerProgress,
  RacerState,
  ShortcutDefinition,
  TrackDefinition,
  TrackSection,
  Vec2,
  Zone,
} from "./types";

export const VIEWPORT_WIDTH = 1000;
export const VIEWPORT_HEIGHT = 760;
export const TOTAL_LAPS = 3;
export const RACER_RADIUS = 24;

const ACCELERATION = 520;
const BRAKE_POWER = 560;
const BASE_MAX_SPEED = 600;
const BASE_TURN_RATE = 2.45;
const BOOST_DURATION = 0.9;
const BOOST_SPEED_MULTIPLIER = 1.32;
const BOOST_PUSH = 460;
const DRIFT_BOOST_DURATION = 0.42;
const DRIFT_BOOST_PUSH = 245;
const DRIFT_CHARGE_RATE = 1.08;
const DRIFT_COOLDOWN = 0.24;
const DRIFT_DRAG = 0.42;
const DRIFT_MAX_CHARGE = 1.2;
const DRIFT_MIN_CHARGE = 0.38;
const DRIFT_MIN_SPEED = 165;
const DRIFT_TURN_MULTIPLIER = 1.42;
const FRICTION = 0.58;
const OFF_TRACK_DRAG = 2.1;
const SLOW_ZONE_DRAG = 2.7;
const CHECKPOINT_RADIUS = 115;
const MAX_DELTA_SECONDS = 1 / 30;
const BASE_HOVER_HEIGHT = 42;

type NearestLane = {
  boundary: TrackSection["boundary"];
  closestPoint: Vec2;
  distance: number;
  kind: "main" | "shortcut";
  normal: Vec2;
  section: TrackSection | null;
  signedOffset: number;
  tangent: Vec2;
  width: number;
};

export function createRacer({
  color,
  id,
  isPlayer,
  name,
  position,
  species,
  startAngle,
  personality,
}: {
  color: string;
  id: string;
  isPlayer: boolean;
  name: string;
  personality: RacerState["personality"];
  position: Vec2;
  species: RacerState["species"];
  startAngle: number;
}): RacerState {
  return {
    angle: startAngle,
    activeShortcutId: null,
    boostTimer: 0,
    checkpointIndex: 1,
    color,
    driftBoostTimer: 0,
    driftCharge: 0,
    driftCooldown: 0,
    driftDirection: 0,
    finishedAt: null,
    hoverHeight: BASE_HOVER_HEIGHT,
    id,
    isDrifting: false,
    isPlayer,
    lap: 0,
    name,
    personality,
    pitch: 0,
    rank: 1,
    roll: 0,
    species,
    shortcutNodeIndex: 0,
    speed: 0,
    suspensionCompression: 0,
    trail: [],
    verticalVelocity: 0,
    x: position.x,
    y: position.y,
  };
}

export function updateRacer({
  controls,
  deltaSeconds,
  elapsedSeconds,
  racer,
  track,
}: {
  controls: InputState;
  deltaSeconds: number;
  elapsedSeconds: number;
  racer: RacerState;
  track: TrackDefinition;
}): void {
  if (racer.finishedAt !== null) {
    racer.speed *= Math.exp(-2.4 * deltaSeconds);
    return;
  }

  const dt = Math.min(deltaSeconds, MAX_DELTA_SECONDS);
  const previous = { x: racer.x, y: racer.y };
  const nearestLane = getNearestLane(racer, track);
  const currentSection = nearestLane.section;
  const onTrack = nearestLane.distance <= nearestLane.width / 2 + RACER_RADIUS * 0.25;
  const inSlowZone = getAllSlowZones(track).some((slowZone) => isInsideZone(racer, slowZone));
  const inBoostZone = getAllBoosters(track).some((booster) => isInsideZone(racer, booster));

  if (inBoostZone) {
    racer.boostTimer = BOOST_DURATION;
    racer.speed += BOOST_PUSH * dt;
  }

  racer.boostTimer = Math.max(0, racer.boostTimer - dt);
  racer.driftBoostTimer = Math.max(0, racer.driftBoostTimer - dt);
  racer.driftCooldown = Math.max(0, racer.driftCooldown - dt);

  const steer = Number(controls.right) - Number(controls.left);
  updateDriftState({
    controls,
    deltaSeconds: dt,
    elapsedSeconds,
    onTrack,
    racer,
    steer,
  });

  const speedFactor = clamp(Math.abs(racer.speed) / 160, 0.34, 1.2);
  const driftTurnBonus = racer.isDrifting ? DRIFT_TURN_MULTIPLIER : 1;
  racer.angle = normalizeAngle(
    racer.angle +
      steer *
        racer.personality.turnRate *
        BASE_TURN_RATE *
        speedFactor *
        driftTurnBonus *
        dt,
  );

  if (controls.throttle) {
    racer.speed += ACCELERATION * racer.personality.aggression * dt;
  }

  if (controls.brake) {
    racer.speed -= BRAKE_POWER * dt;
  }

  if (!controls.throttle && !controls.brake) {
    racer.speed *= Math.exp(-FRICTION * dt);
  }

  if (racer.isDrifting) {
    racer.speed *= Math.exp(-DRIFT_DRAG * dt);
    racer.roll += racer.driftDirection * 0.018;
  }

  if (!onTrack) {
    racer.speed *= Math.exp(-OFF_TRACK_DRAG * dt);
  }

  if (inSlowZone) {
    racer.speed *= Math.exp(-SLOW_ZONE_DRAG * dt);
  }

  const maxSpeed =
    (racer.personality.maxSpeed || BASE_MAX_SPEED) *
    (racer.boostTimer > 0 ? BOOST_SPEED_MULTIPLIER : 1) *
    (onTrack ? 1 : 0.68) *
    (inSlowZone ? 0.58 : 1);
  racer.speed = clamp(racer.speed, -82, maxSpeed);
  moveRacerWithBoundary({
    elapsedSeconds,
    racer,
    track,
    x: racer.x + Math.cos(racer.angle) * racer.speed * dt,
    y: racer.y + Math.sin(racer.angle) * racer.speed * dt,
  });

  resolveBounds(racer, track);
  applyHazards(racer, track, elapsedSeconds, dt, previous);
  resolveBounds(racer, track);
  resolveTrackBoundary(racer, track, elapsedSeconds);

  if (track.barriers.some((barrier) => hitBarrier(racer, barrier, elapsedSeconds))) {
    racer.x = previous.x;
    racer.y = previous.y;
    racer.speed *= -0.32;
    racer.angle = normalizeAngle(racer.angle + (racer.isPlayer ? 0.42 : -0.32));
    racer.boostTimer = 0;
    addImpactReaction(racer, elapsedSeconds, 42);
  }

  updateHoverPhysics({
    controls,
    deltaSeconds: dt,
    inBoostZone,
    inSlowZone,
    onTrack,
    racer,
    section: currentSection,
    steer,
  });

  racer.trail = [
    { x: racer.x, y: racer.y },
    ...racer.trail.slice(0, racer.boostTimer > 0 || racer.isDrifting ? 13 : 8),
  ];

  updateShortcutState(racer, track);
  updateCheckpoint(racer, track, elapsedSeconds);
  clearCompletedShortcut(racer, track);
}

export function rankRacers(racers: RacerState[], track: TrackDefinition): RacerProgress[] {
  return racers
    .map((racer) => ({
      distanceToNext: distance(racer, track.checkpoints[racer.checkpointIndex]),
      racer,
      score: getProgressScore(racer, track),
    }))
    .sort((a, b) => {
      if (a.racer.finishedAt !== null && b.racer.finishedAt !== null) {
        return a.racer.finishedAt - b.racer.finishedAt;
      }

      if (a.racer.finishedAt !== null) {
        return -1;
      }

      if (b.racer.finishedAt !== null) {
        return 1;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.distanceToNext - b.distanceToNext;
    });
}

export function getRemainingCheckpoints(racer: RacerState, track: TrackDefinition): number {
  return racer.checkpointIndex === 0
    ? 1
    : track.checkpoints.length - racer.checkpointIndex + 1;
}

export function getMovingBarrier(
  barrier: EnergyBarrier,
  elapsedSeconds: number,
): EnergyBarrier {
  if (!barrier.motion) {
    return barrier;
  }

  const wave =
    0.5 + Math.sin(elapsedSeconds * barrier.motion.speed + (barrier.motion.phase ?? 0)) * 0.5;
  const value = barrier.motion.min + (barrier.motion.max - barrier.motion.min) * wave;

  return {
    ...barrier,
    x: barrier.motion.axis === "x" ? value : barrier.x,
    y: barrier.motion.axis === "y" ? value : barrier.y,
  };
}

export function getAllBoosters(track: TrackDefinition): Zone[] {
  return [
    ...track.boosters,
    ...track.shortcuts.flatMap((shortcut) => shortcut.boosters),
  ];
}

export function getAllSlowZones(track: TrackDefinition): Zone[] {
  return [
    ...track.slowZones,
    ...track.shortcuts.flatMap((shortcut) => shortcut.slowZones),
  ];
}

export function getAllHazards(track: TrackDefinition): HazardDefinition[] {
  return [
    ...track.hazards,
    ...track.shortcuts.flatMap((shortcut) => shortcut.hazards),
  ];
}

export function getHazardPosition(
  hazard: HazardDefinition,
  elapsedSeconds: number,
): Vec2 {
  let x = hazard.x;
  let y = hazard.y;

  if (hazard.motion) {
    const wave =
      0.5 + Math.sin(elapsedSeconds * hazard.motion.speed + (hazard.motion.phase ?? 0)) * 0.5;
    const value = hazard.motion.min + (hazard.motion.max - hazard.motion.min) * wave;

    x = hazard.motion.axis === "x" ? value : x;
    y = hazard.motion.axis === "y" ? value : y;
  }

  if (hazard.orbit) {
    const angle =
      elapsedSeconds * hazard.orbit.speed + (hazard.orbit.phase ?? hazard.phase ?? 0);

    x += Math.cos(angle) * hazard.orbit.radius;
    y += Math.sin(angle) * hazard.orbit.radius;
  }

  return { x, y };
}

export function getHazardAngle(
  hazard: HazardDefinition,
  elapsedSeconds: number,
): number {
  if (hazard.kind === "rotorArm") {
    return (hazard.angle ?? 0) + elapsedSeconds * (hazard.speed ?? 1);
  }

  return hazard.angle ?? 0;
}

export function isLaserGateOpen(
  hazard: HazardDefinition,
  elapsedSeconds: number,
): boolean {
  if (hazard.kind !== "laserGate") {
    return true;
  }

  const cycle = hazard.cycle ?? 3;
  const openRatio = hazard.openRatio ?? 0.45;
  const phase = positiveModulo(elapsedSeconds + (hazard.phase ?? 0), cycle) / cycle;

  return phase < openRatio;
}

export function isInsideZone(point: Vec2, zone: Zone): boolean {
  const local = toLocalPoint(point, zone);

  return (
    Math.abs(local.x) <= zone.width / 2 &&
    Math.abs(local.y) <= zone.height / 2
  );
}

export function getDistanceToTrack(point: Vec2, track: TrackDefinition): number {
  return getNearestLane(point, track).distance;
}

export function getMainSegmentWidth(
  track: TrackDefinition,
  segmentIndex: number,
): number {
  return getTrackSection(track, segmentIndex)?.width ?? track.trackWidth;
}

export function getTrackSection(
  track: TrackDefinition,
  segmentIndex: number,
): TrackSection | null {
  return (
    track.sections.find((section) =>
      isSegmentInSection(
        normalizeSegmentIndex(segmentIndex, track.checkpoints.length),
        section,
        track.checkpoints.length,
      ),
    ) ?? null
  );
}

export function normalizeAngle(angle: number): number {
  let nextAngle = angle;

  while (nextAngle > Math.PI) {
    nextAngle -= Math.PI * 2;
  }

  while (nextAngle < -Math.PI) {
    nextAngle += Math.PI * 2;
  }

  return nextAngle;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getNearestLane(
  point: Vec2,
  track: TrackDefinition,
): NearestLane {
  let nearest: NearestLane = {
    boundary: "soft",
    closestPoint: { x: point.x, y: point.y },
    distance: Number.POSITIVE_INFINITY,
    kind: "main",
    normal: { x: 0, y: 1 },
    section: null as TrackSection | null,
    signedOffset: 0,
    tangent: { x: 1, y: 0 },
    width: track.trackWidth,
  };

  for (let index = 0; index < track.checkpoints.length; index += 1) {
    const current = track.checkpoints[index];
    const next = track.checkpoints[(index + 1) % track.checkpoints.length];
    const projection = projectToSegment(point, current, next);
    const section = getTrackSection(track, index);
    const width = section?.width ?? track.trackWidth;

    if (projection.distance < nearest.distance) {
      nearest = {
        ...projection,
        boundary: section?.boundary ?? inferBoundary(section),
        kind: "main",
        section,
        width,
      };
    }
  }

  for (const shortcut of track.shortcuts) {
    for (let index = 0; index < shortcut.path.length - 1; index += 1) {
      const projection = projectToSegment(
        point,
        shortcut.path[index],
        shortcut.path[index + 1],
      );

      if (projection.distance < nearest.distance) {
        nearest = {
          ...projection,
          boundary: "wall",
          kind: "shortcut",
          section: null,
          width: shortcut.width,
        };
      }
    }
  }

  return nearest;
}

function inferBoundary(section: TrackSection | null): TrackSection["boundary"] {
  if (!section) {
    return "soft";
  }

  if (
    section.wallHeight > 0 ||
    section.kind === "canyon" ||
    section.kind === "creep" ||
    section.kind === "hangar" ||
    section.kind === "reactor" ||
    section.kind === "tunnel" ||
    section.kind === "warp"
  ) {
    return "wall";
  }

  return section.rail === "none" ? "soft" : "rail";
}

function updateShortcutState(racer: RacerState, track: TrackDefinition): void {
  if (racer.activeShortcutId) {
    const activeShortcut = findShortcut(track, racer.activeShortcutId);
    const nextNode = activeShortcut?.path[racer.shortcutNodeIndex];

    if (nextNode && distance(racer, nextNode) <= CHECKPOINT_RADIUS * 1.2) {
      racer.shortcutNodeIndex += 1;
    }

    return;
  }

  const shortcut = track.shortcuts.find(
    (entry) =>
      entry.entryCheckpointIndex === racer.checkpointIndex &&
      canEnterShortcut(racer, entry) &&
      isInsideZone(racer, entry.gate),
  );

  if (!shortcut) {
    return;
  }

  racer.activeShortcutId = shortcut.id;
  racer.shortcutNodeIndex = 1;
  racer.checkpointIndex = shortcut.exitCheckpointIndex;
}

function canEnterShortcut(
  racer: RacerState,
  shortcut: ShortcutDefinition,
): boolean {
  if (racer.isPlayer) {
    return true;
  }

  const seed = Math.abs(
    Math.sin((racer.personality.phase + racer.lap * 1.71 + shortcut.aiUseChance * 8.33) * 12.9898),
  );

  return seed < shortcut.aiUseChance;
}

function clearCompletedShortcut(racer: RacerState, track: TrackDefinition): void {
  if (!racer.activeShortcutId) {
    return;
  }

  const shortcut = findShortcut(track, racer.activeShortcutId);

  if (!shortcut || racer.checkpointIndex !== shortcut.exitCheckpointIndex) {
    racer.activeShortcutId = null;
    racer.shortcutNodeIndex = 0;
  }
}

function findShortcut(
  track: TrackDefinition,
  shortcutId: string,
): ShortcutDefinition | undefined {
  return track.shortcuts.find((shortcut) => shortcut.id === shortcutId);
}

function updateCheckpoint(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): void {
  const checkpoint = track.checkpoints[racer.checkpointIndex];

  if (distance(racer, checkpoint) > CHECKPOINT_RADIUS) {
    return;
  }

  if (racer.checkpointIndex === 0) {
    racer.lap += 1;

    if (racer.lap >= TOTAL_LAPS && racer.finishedAt === null) {
      racer.finishedAt = elapsedSeconds;
      racer.speed *= 0.62;
      return;
    }

    racer.checkpointIndex = 1;
    return;
  }

  racer.checkpointIndex = (racer.checkpointIndex + 1) % track.checkpoints.length;
}

function getProgressScore(racer: RacerState, track: TrackDefinition): number {
  const checkpoints = track.checkpoints.length;
  const passedThisLap =
    racer.checkpointIndex === 0 ? checkpoints - 1 : racer.checkpointIndex - 1;

  return racer.lap * checkpoints + passedThisLap;
}

function updateDriftState({
  controls,
  deltaSeconds,
  elapsedSeconds,
  onTrack,
  racer,
  steer,
}: {
  controls: InputState;
  deltaSeconds: number;
  elapsedSeconds: number;
  onTrack: boolean;
  racer: RacerState;
  steer: number;
}): void {
  const canChargeDrift =
    controls.drift &&
    (onTrack || racer.isDrifting) &&
    Math.abs(steer) > 0 &&
    Math.abs(racer.speed) >= DRIFT_MIN_SPEED;

  if (canChargeDrift) {
    racer.isDrifting = true;
    racer.driftDirection = steer;
    racer.driftCharge = clamp(
      racer.driftCharge + DRIFT_CHARGE_RATE * (0.78 + Math.abs(steer) * 0.34) * deltaSeconds,
      0,
      DRIFT_MAX_CHARGE,
    );
    racer.pitch += 0.006;
    return;
  }

  if (racer.isDrifting) {
    const charge = racer.driftCharge;
    const boostRatio = clamp(
      (charge - DRIFT_MIN_CHARGE) / (DRIFT_MAX_CHARGE - DRIFT_MIN_CHARGE),
      0,
      1,
    );

    if (
      charge >= DRIFT_MIN_CHARGE &&
      racer.driftCooldown <= 0 &&
      Math.abs(racer.speed) >= DRIFT_MIN_SPEED * 0.68
    ) {
      racer.boostTimer = Math.max(
        racer.boostTimer,
        DRIFT_BOOST_DURATION + boostRatio * 0.22,
      );
      racer.driftBoostTimer = DRIFT_BOOST_DURATION + boostRatio * 0.26;
      racer.speed += DRIFT_BOOST_PUSH + boostRatio * 155;
      racer.verticalVelocity += 18 + boostRatio * 16;
      racer.roll += racer.driftDirection * (0.08 + boostRatio * 0.06);
      addImpactReaction(racer, elapsedSeconds + boostRatio * 0.23, 14 + boostRatio * 16);
    }

    racer.isDrifting = false;
    racer.driftCharge = 0;
    racer.driftCooldown = DRIFT_COOLDOWN;
    racer.driftDirection = 0;
    return;
  }

  racer.driftCharge *= Math.exp(-5.2 * deltaSeconds);
  if (racer.driftCharge < 0.01) {
    racer.driftCharge = 0;
  }
}

function updateHoverPhysics({
  controls,
  deltaSeconds,
  inBoostZone,
  inSlowZone,
  onTrack,
  racer,
  section,
  steer,
}: {
  controls: InputState;
  deltaSeconds: number;
  inBoostZone: boolean;
  inSlowZone: boolean;
  onTrack: boolean;
  racer: RacerState;
  section: TrackSection | null;
  steer: number;
}): void {
  const speedRatio = clamp(Math.abs(racer.speed) / 620, 0, 1.35);
  const grade = section?.grade ?? 0;
  const bank = section?.bank ?? 0;
  const sectionLift = (section?.elevation ?? 0) * 0.08 + Math.max(0, grade) * 36;
  const targetHover =
    BASE_HOVER_HEIGHT +
    speedRatio * 16 +
    sectionLift +
    (racer.boostTimer > 0 ? 30 : 0) -
    (racer.isDrifting ? 8 : 0) -
    (inSlowZone ? 10 : 0) -
    (onTrack ? 0 : 16);
  const spring = (targetHover - racer.hoverHeight) * 8.4;
  const damping = racer.verticalVelocity * 4.8;

  if (inBoostZone) {
    racer.verticalVelocity += 54 * deltaSeconds;
  }

  racer.verticalVelocity += (spring - damping) * deltaSeconds;
  racer.hoverHeight = clamp(racer.hoverHeight + racer.verticalVelocity * deltaSeconds, 16, 118);

  if (racer.hoverHeight <= 16.1 && racer.verticalVelocity < 0) {
    racer.verticalVelocity *= -0.26;
    racer.suspensionCompression = Math.min(1, racer.suspensionCompression + 0.28);
  }

  const targetPitch =
    (section?.cameraPitch ?? 0) +
    grade * 0.72 +
    (controls.throttle ? -0.025 : 0) +
    (controls.brake ? 0.07 : 0) -
    (racer.isDrifting ? 0.045 : 0) -
    racer.verticalVelocity * 0.0024;
  const targetRoll =
    bank -
    steer * speedRatio * 0.22 +
    racer.driftDirection * clamp(racer.driftCharge / DRIFT_MAX_CHARGE, 0, 1) * 0.16;
  const pitchFollow = 1 - Math.exp(-5.2 * deltaSeconds);
  const rollFollow = 1 - Math.exp(-6.4 * deltaSeconds);

  racer.pitch += (targetPitch - racer.pitch) * pitchFollow;
  racer.roll += (targetRoll - racer.roll) * rollFollow;
  racer.suspensionCompression +=
    (clamp((BASE_HOVER_HEIGHT - racer.hoverHeight) / 28, 0, 1) -
      racer.suspensionCompression) *
    (1 - Math.exp(-8 * deltaSeconds));
}

function applyHazards(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
  deltaSeconds: number,
  previous: Vec2,
): void {
  for (const hazard of getHazardsForRacer(track, racer)) {
    const position = getHazardPosition(hazard, elapsedSeconds);

    if (hazard.kind === "gravityWell") {
      applyGravityWell(racer, hazard, position, deltaSeconds);
      continue;
    }

    if (hazard.kind === "crosswind") {
      applyCrosswind(racer, hazard, position, elapsedSeconds, deltaSeconds);
      continue;
    }

    if (hazard.kind === "plasmaMine") {
      applyPlasmaMine(racer, hazard, position);
      continue;
    }

    if (hazard.kind === "laserGate") {
      if (isLaserGateOpen(hazard, elapsedSeconds)) {
        continue;
      }

      if (hitRectHazard(racer, hazard, position, getHazardAngle(hazard, elapsedSeconds))) {
        bounceFromHazard(racer, previous, hazard, elapsedSeconds, 0.28);
      }

      continue;
    }

    if (
      hazard.kind === "rotorArm" &&
      hitRectHazard(racer, hazard, position, getHazardAngle(hazard, elapsedSeconds))
    ) {
      bounceFromHazard(racer, previous, hazard, elapsedSeconds, 0.22);
    }
  }
}

function getHazardsForRacer(
  track: TrackDefinition,
  racer: RacerState,
): HazardDefinition[] {
  return [
    ...track.hazards,
    ...track.shortcuts.flatMap((shortcut) => {
      if (
        racer.activeShortcutId === shortcut.id ||
        distanceToShortcut(racer, shortcut) <= shortcut.width * 0.75 + RACER_RADIUS
      ) {
        return shortcut.hazards;
      }

      return [];
    }),
  ];
}

function distanceToShortcut(point: Vec2, shortcut: ShortcutDefinition): number {
  let nearest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < shortcut.path.length - 1; index += 1) {
    nearest = Math.min(
      nearest,
      distanceToSegment(point, shortcut.path[index], shortcut.path[index + 1]),
    );
  }

  return nearest;
}

function applyGravityWell(
  racer: RacerState,
  hazard: HazardDefinition,
  position: Vec2,
  deltaSeconds: number,
): void {
  const radius = hazard.radius ?? 420;
  const pullDistance = distance(racer, position);

  if (pullDistance >= radius || pullDistance <= 1) {
    return;
  }

  const pull = (hazard.strength ?? 220) * (1 - pullDistance / radius) * deltaSeconds;
  const dx = (position.x - racer.x) / pullDistance;
  const dy = (position.y - racer.y) / pullDistance;
  const targetAngle = Math.atan2(dy, dx);

  racer.x += dx * pull;
  racer.y += dy * pull;
  racer.angle = normalizeAngle(
    racer.angle + normalizeAngle(targetAngle - racer.angle) * 0.12 * deltaSeconds,
  );
  racer.verticalVelocity -= (hazard.strength ?? 220) * 0.16 * (1 - pullDistance / radius) * deltaSeconds;
  racer.pitch += 0.16 * deltaSeconds;
  racer.speed *= Math.exp(-0.12 * deltaSeconds);
}

function applyCrosswind(
  racer: RacerState,
  hazard: HazardDefinition,
  position: Vec2,
  elapsedSeconds: number,
  deltaSeconds: number,
): void {
  const zone: Zone = {
    angle: hazard.angle ?? 0,
    height: hazard.height ?? 500,
    id: hazard.id,
    width: hazard.width ?? 900,
    x: position.x,
    y: position.y,
  };

  if (!isInsideZone(racer, zone)) {
    return;
  }

  const gust = (hazard.strength ?? 170) * (0.7 + Math.sin(elapsedSeconds * 4 + (hazard.phase ?? 0)) * 0.3);
  const direction = (hazard.angle ?? 0) + Math.PI / 2;

  racer.x += Math.cos(direction) * gust * deltaSeconds;
  racer.y += Math.sin(direction) * gust * deltaSeconds;
  racer.angle = normalizeAngle(
    racer.angle + Math.sin(elapsedSeconds * 3.2 + (hazard.phase ?? 0)) * 0.22 * deltaSeconds,
  );
}

function applyPlasmaMine(
  racer: RacerState,
  hazard: HazardDefinition,
  position: Vec2,
): void {
  const radius = (hazard.radius ?? 70) + RACER_RADIUS;
  const hitDistance = distance(racer, position);

  if (hitDistance > radius || hitDistance <= 1) {
    return;
  }

  const awayAngle = Math.atan2(racer.y - position.y, racer.x - position.x);
  const push = Math.max(90, Math.abs(racer.speed) * 0.42);

  racer.x += Math.cos(awayAngle) * 38;
  racer.y += Math.sin(awayAngle) * 38;
  racer.angle = awayAngle;
  racer.speed = push;
  addImpactReaction(racer, hazard.phase ?? 0, 56);
  racer.boostTimer = 0;
}

function bounceFromHazard(
  racer: RacerState,
  previous: Vec2,
  hazard: HazardDefinition,
  elapsedSeconds: number,
  speedMultiplier: number,
): void {
  racer.x = previous.x;
  racer.y = previous.y;
  racer.speed *= -speedMultiplier;
  racer.angle = normalizeAngle(
    racer.angle + Math.sin(elapsedSeconds * 2.7 + (hazard.phase ?? 0)) * 0.7,
  );
  addImpactReaction(racer, elapsedSeconds + (hazard.phase ?? 0), 64);
  racer.boostTimer = 0;
}

function addImpactReaction(
  racer: RacerState,
  seed: number,
  strength: number,
): void {
  racer.verticalVelocity += strength;
  racer.pitch += 0.09 + strength * 0.0012;
  racer.roll += Math.sin(seed * 3.17) * 0.32;
  racer.suspensionCompression = Math.min(1, racer.suspensionCompression + strength / 90);
}

function hitRectHazard(
  racer: RacerState,
  hazard: HazardDefinition,
  position: Vec2,
  angle: number,
): boolean {
  const width = hazard.width ?? 120;
  const height = hazard.height ?? 420;
  const local = toLocalPoint(racer, {
    angle,
    x: position.x,
    y: position.y,
  });
  const nearestX = clamp(local.x, -width / 2, width / 2);
  const nearestY = clamp(local.y, -height / 2, height / 2);
  const dx = local.x - nearestX;
  const dy = local.y - nearestY;

  return dx * dx + dy * dy <= RACER_RADIUS * RACER_RADIUS;
}

function hitBarrier(
  racer: RacerState,
  barrier: EnergyBarrier,
  elapsedSeconds: number,
): boolean {
  const movingBarrier = getMovingBarrier(barrier, elapsedSeconds);
  const local = toLocalPoint(racer, movingBarrier);
  const nearestX = clamp(local.x, -movingBarrier.width / 2, movingBarrier.width / 2);
  const nearestY = clamp(local.y, -movingBarrier.height / 2, movingBarrier.height / 2);
  const dx = local.x - nearestX;
  const dy = local.y - nearestY;

  return dx * dx + dy * dy <= RACER_RADIUS * RACER_RADIUS;
}

function toLocalPoint(
  point: Vec2,
  rect: { angle?: number; x: number; y: number },
): Vec2 {
  const angle = -(rect.angle ?? 0);
  const dx = point.x - rect.x;
  const dy = point.y - rect.y;

  return {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

function moveRacerWithBoundary({
  elapsedSeconds,
  racer,
  track,
  x,
  y,
}: {
  elapsedSeconds: number;
  racer: RacerState;
  track: TrackDefinition;
  x: number;
  y: number;
}): void {
  const constrained = getBoundaryConstrainedPoint({ x, y }, track);

  racer.x = constrained.x;
  racer.y = constrained.y;

  if (!constrained.hit) {
    return;
  }

  applyBoundarySlide(
    racer,
    constrained.lane,
    constrained.side,
    constrained.penetration,
    elapsedSeconds,
  );
}

function resolveTrackBoundary(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): void {
  const constrained = getBoundaryConstrainedPoint(racer, track);

  if (!constrained.hit) {
    return;
  }

  racer.x = constrained.x;
  racer.y = constrained.y;
  applyBoundarySlide(
    racer,
    constrained.lane,
    constrained.side,
    constrained.penetration,
    elapsedSeconds,
  );
}

function getBoundaryConstrainedPoint(
  point: Vec2,
  track: TrackDefinition,
): Vec2 & {
  hit: boolean;
  lane: NearestLane;
  penetration: number;
  side: number;
} {
  const lane = getNearestLane(point, track);

  if (lane.boundary === "soft") {
    return { ...point, hit: false, lane, penetration: 0, side: 1 };
  }

  const maxOffset = getBoundaryMaxOffset(lane);

  if (lane.distance <= maxOffset) {
    return { ...point, hit: false, lane, penetration: 0, side: 1 };
  }

  const side = lane.signedOffset >= 0 ? 1 : -1;
  const outwardNormal = {
    x: lane.normal.x * side,
    y: lane.normal.y * side,
  };
  const correctedOffset = Math.max(RACER_RADIUS, maxOffset - 0.8);

  return {
    hit: true,
    lane,
    penetration: lane.distance - maxOffset,
    side,
    x: lane.closestPoint.x + outwardNormal.x * correctedOffset,
    y: lane.closestPoint.y + outwardNormal.y * correctedOffset,
  };
}

function getBoundaryMaxOffset(lane: NearestLane): number {
  const boundaryPadding =
    lane.boundary === "wall" ? RACER_RADIUS * 0.72 : RACER_RADIUS * 0.52;

  return Math.max(RACER_RADIUS * 1.15, lane.width / 2 - boundaryPadding);
}

function applyBoundarySlide(
  racer: RacerState,
  lane: NearestLane,
  side: number,
  penetration: number,
  elapsedSeconds: number,
): void {
  const outwardNormal = {
    x: lane.normal.x * side,
    y: lane.normal.y * side,
  };
  const velocity = {
    x: Math.cos(racer.angle) * racer.speed,
    y: Math.sin(racer.angle) * racer.speed,
  };
  const outwardSpeed =
    velocity.x * outwardNormal.x + velocity.y * outwardNormal.y;
  const tangentSpeed =
    velocity.x * lane.tangent.x + velocity.y * lane.tangent.y;

  if (outwardSpeed > 0) {
    const scrapeDamping =
      lane.boundary === "wall"
        ? clamp(1 - outwardSpeed / 900, 0.48, 0.82)
        : clamp(1 - outwardSpeed / 1200, 0.58, 0.88);
    const tangentDirection = tangentSpeed >= 0 ? 1 : -1;
    const nextSpeed = Math.abs(tangentSpeed) * scrapeDamping;

    if (nextSpeed > 1) {
      racer.angle = normalizeAngle(
        Math.atan2(lane.tangent.y * tangentDirection, lane.tangent.x * tangentDirection),
      );
      racer.speed = nextSpeed;
    } else {
      racer.speed = 0;
    }
  } else {
    racer.speed *= lane.boundary === "wall" ? 0.9 : 0.96;
  }

  racer.boostTimer *= lane.boundary === "wall" ? 0.22 : 0.48;
  racer.roll += side * (lane.boundary === "wall" ? 0.18 : 0.1);

  if (outwardSpeed > 35 || penetration > 7) {
    addImpactReaction(
      racer,
      elapsedSeconds + side * 0.37,
      clamp(16 + penetration * 0.7 + Math.max(0, outwardSpeed) * 0.05, 18, 74),
    );
  }
}

function resolveBounds(racer: RacerState, track: TrackDefinition): void {
  const nextX = clamp(racer.x, RACER_RADIUS, track.worldWidth - RACER_RADIUS);
  const nextY = clamp(racer.y, RACER_RADIUS, track.worldHeight - RACER_RADIUS);

  if (nextX !== racer.x) {
    racer.speed *= 0.45;
    racer.x = nextX;
  }

  if (nextY !== racer.y) {
    racer.speed *= 0.45;
    racer.y = nextY;
  }
}

function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  return projectToSegment(point, a, b).distance;
}

function projectToSegment(point: Vec2, a: Vec2, b: Vec2): Omit<NearestLane, "boundary" | "kind" | "section" | "width"> {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  const t = lengthSquared === 0 ? 0 : clamp((apx * abx + apy * aby) / lengthSquared, 0, 1);
  const x = a.x + abx * t;
  const y = a.y + aby * t;
  const length = Math.sqrt(lengthSquared) || 1;
  const tangent = {
    x: abx / length,
    y: aby / length,
  };
  const normal = {
    x: -tangent.y,
    y: tangent.x,
  };
  const offset = {
    x: point.x - x,
    y: point.y - y,
  };
  const signedOffset = offset.x * normal.x + offset.y * normal.y;

  return {
    closestPoint: { x, y },
    distance: Math.hypot(point.x - x, point.y - y),
    normal,
    signedOffset,
    tangent,
  };
}

function isSegmentInSection(
  segmentIndex: number,
  section: TrackSection,
  segmentCount: number,
): boolean {
  const start = normalizeSegmentIndex(section.startCheckpointIndex, segmentCount);
  const end = normalizeSegmentIndex(section.endCheckpointIndex, segmentCount);

  if (start <= end) {
    return segmentIndex >= start && segmentIndex <= end;
  }

  return segmentIndex >= start || segmentIndex <= end;
}

function normalizeSegmentIndex(index: number, segmentCount: number): number {
  return positiveModulo(index, segmentCount);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
