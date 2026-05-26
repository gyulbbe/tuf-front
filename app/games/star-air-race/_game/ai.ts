import type { InputState, RacerState, TrackDefinition, Vec2 } from "./types";
import {
  distance,
  getAllHazards,
  getHazardPosition,
  isLaserGateOpen,
  normalizeAngle,
} from "./physics";

export function getAiControls(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): InputState {
  const target = getAiTarget(racer, track, elapsedSeconds);
  const targetAngle = Math.atan2(target.y - racer.y, target.x - racer.x);
  const angleDelta = normalizeAngle(targetAngle - racer.angle);
  const targetDistance = distance(racer, target);
  const sharpTurn = Math.abs(angleDelta) > 1.05;
  const verySharpTurn = Math.abs(angleDelta) > 1.48;
  const hazardAhead = hasImmediateHazardAhead(racer, track, elapsedSeconds);

  return {
    brake: (verySharpTurn || hazardAhead) && racer.speed > 115,
    drift: false,
    left: angleDelta < -0.04,
    right: angleDelta > 0.04,
    throttle:
      targetDistance > 44 &&
      !hazardAhead &&
      (!sharpTurn || racer.speed < 190 + racer.personality.aggression * 34),
  };
}

function getAiTarget(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): Vec2 {
  const activeShortcut = racer.activeShortcutId
    ? track.shortcuts.find((shortcut) => shortcut.id === racer.activeShortcutId)
    : undefined;

  if (activeShortcut) {
    return avoidHazards(
      racer,
      activeShortcut.path[racer.shortcutNodeIndex] ??
        track.checkpoints[activeShortcut.exitCheckpointIndex],
      track,
      elapsedSeconds,
    );
  }

  const shortcut = track.shortcuts.find(
    (entry) =>
      entry.entryCheckpointIndex === racer.checkpointIndex &&
      shouldUseShortcut(racer, entry.aiUseChance),
  );

  if (shortcut) {
    return avoidHazards(racer, shortcut.gate, track, elapsedSeconds);
  }

  const checkpoint = track.checkpoints[racer.checkpointIndex];
  const previous =
    track.checkpoints[
      (racer.checkpointIndex - 1 + track.checkpoints.length) %
        track.checkpoints.length
    ];
  const dx = checkpoint.x - previous.x;
  const dy = checkpoint.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const weave =
    Math.sin(elapsedSeconds * 0.9 + racer.personality.phase) *
    racer.personality.lineOffset;

  return avoidHazards(
    racer,
    {
      x: checkpoint.x + normalX * weave,
      y: checkpoint.y + normalY * weave,
    },
    track,
    elapsedSeconds,
  );
}

function shouldUseShortcut(racer: RacerState, chance: number): boolean {
  const seed = Math.abs(
    Math.sin((racer.personality.phase + racer.lap * 1.71 + chance * 8.33) * 12.9898),
  );

  return seed < chance;
}

function avoidHazards(
  racer: RacerState,
  target: Vec2,
  track: TrackDefinition,
  elapsedSeconds: number,
): Vec2 {
  let offsetX = 0;
  let offsetY = 0;

  for (const hazard of getAllHazards(track)) {
    if (hazard.shortcutId && racer.activeShortcutId !== hazard.shortcutId) {
      continue;
    }

    if (hazard.kind === "laserGate" && isLaserGateOpen(hazard, elapsedSeconds)) {
      continue;
    }

    const hazardPosition = getHazardPosition(hazard, elapsedSeconds);
    const hazardDistance = distance(racer, hazardPosition);
    const influence =
      hazard.kind === "gravityWell" ? hazard.radius ?? 520 : hazard.radius ?? 360;

    if (hazardDistance > influence || hazardDistance <= 1) {
      continue;
    }

    const strength = (1 - hazardDistance / influence) * 260;

    offsetX += ((racer.x - hazardPosition.x) / hazardDistance) * strength;
    offsetY += ((racer.y - hazardPosition.y) / hazardDistance) * strength;
  }

  return {
    x: target.x + offsetX,
    y: target.y + offsetY,
  };
}

function hasImmediateHazardAhead(
  racer: RacerState,
  track: TrackDefinition,
  elapsedSeconds: number,
): boolean {
  const forwardX = Math.cos(racer.angle);
  const forwardY = Math.sin(racer.angle);

  return getAllHazards(track).some((hazard) => {
    if (hazard.shortcutId && racer.activeShortcutId !== hazard.shortcutId) {
      return false;
    }

    if (hazard.kind === "laserGate" && isLaserGateOpen(hazard, elapsedSeconds)) {
      return false;
    }

    const hazardPosition = getHazardPosition(hazard, elapsedSeconds);
    const dx = hazardPosition.x - racer.x;
    const dy = hazardPosition.y - racer.y;
    const forwardDistance = dx * forwardX + dy * forwardY;
    const sideDistance = Math.abs(dx * -forwardY + dy * forwardX);

    return forwardDistance > 0 && forwardDistance < 520 && sideDistance < 180;
  });
}
