export type Vec2 = {
  x: number;
  y: number;
};

export type InputState = {
  brake: boolean;
  drift: boolean;
  left: boolean;
  right: boolean;
  throttle: boolean;
};

export type Species = "protoss" | "terran" | "zerg";

export type TrackTheme = "asteroid" | "nebula" | "station";

export type TrackSectionKind =
  | "bridge"
  | "canyon"
  | "creep"
  | "hangar"
  | "open"
  | "reactor"
  | "tunnel"
  | "warp";

export type RoadSurface = "creep" | "crystal" | "metal" | "runway";

export type TrackBoundary = "rail" | "soft" | "wall";

export type Zone = Vec2 & {
  angle?: number;
  height: number;
  id: string;
  width: number;
};

export type EnergyBarrier = Vec2 & {
  angle: number;
  height: number;
  id: string;
  motion?: {
    axis: "x" | "y";
    max: number;
    min: number;
    phase?: number;
    speed: number;
  };
  width: number;
};

export type HazardKind =
  | "crosswind"
  | "gravityWell"
  | "laserGate"
  | "plasmaMine"
  | "rotorArm";

export type HazardDefinition = Vec2 & {
  angle?: number;
  cycle?: number;
  height?: number;
  id: string;
  kind: HazardKind;
  motion?: EnergyBarrier["motion"];
  openRatio?: number;
  orbit?: {
    phase?: number;
    radius: number;
    speed: number;
  };
  phase?: number;
  radius?: number;
  shortcutId?: string;
  speed?: number;
  strength?: number;
  width?: number;
};

export type Spectator = Vec2 & {
  action: "flag" | "jump" | "wave";
  phase: number;
  species: Species;
};

export type TrackSection = {
  accentColor: string;
  bank: number;
  boundary: TrackBoundary;
  cameraPitch: number;
  ceilingHeight: number;
  endCheckpointIndex: number;
  elevation: number;
  fogDensity: number;
  grade: number;
  id: string;
  kind: TrackSectionKind;
  rail: "energy" | "metal" | "none" | "organic";
  startCheckpointIndex: number;
  surface: RoadSurface;
  visibility: number;
  wallHeight: number;
  width: number;
};

export type SceneryKind =
  | "asteroid"
  | "creepColumn"
  | "energyRing"
  | "hangarWall"
  | "neonSign"
  | "pylon"
  | "reactorCore"
  | "terranTower"
  | "warpCrystal"
  | "zergSpire";

export type SceneryObject = Vec2 & {
  angle?: number;
  id: string;
  kind: SceneryKind;
  phase?: number;
  scale: number;
  species?: Species;
};

export type ShortcutDefinition = {
  aiUseChance: number;
  boosters: Zone[];
  entryCheckpointIndex: number;
  exitCheckpointIndex: number;
  gate: Zone;
  hazards: HazardDefinition[];
  id: string;
  name: string;
  path: Vec2[];
  slowZones: Zone[];
  width: number;
};

export type TrackDefinition = {
  barriers: EnergyBarrier[];
  boosters: Zone[];
  checkpoints: Vec2[];
  description: string;
  hazards: HazardDefinition[];
  id: number;
  name: string;
  scenery: SceneryObject[];
  sections: TrackSection[];
  shortcuts: ShortcutDefinition[];
  slowZones: Zone[];
  spectators: Spectator[];
  startAngle: number;
  startPositions: Vec2[];
  theme: TrackTheme;
  trackWidth: number;
  worldHeight: number;
  worldWidth: number;
};

export type RacerPersonality = {
  aggression: number;
  lineOffset: number;
  maxSpeed: number;
  phase: number;
  turnRate: number;
};

export type RacerState = Vec2 & {
  angle: number;
  activeShortcutId: string | null;
  boostTimer: number;
  checkpointIndex: number;
  color: string;
  driftBoostTimer: number;
  driftCharge: number;
  driftCooldown: number;
  driftDirection: number;
  finishedAt: number | null;
  hoverHeight: number;
  id: string;
  isDrifting: boolean;
  isPlayer: boolean;
  lap: number;
  name: string;
  personality: RacerPersonality;
  pitch: number;
  rank: number;
  roll: number;
  species: Species;
  speed: number;
  shortcutNodeIndex: number;
  suspensionCompression: number;
  trail: Vec2[];
  verticalVelocity: number;
};

export type RacePhase = "countdown" | "finished" | "racing";

export type RunState = {
  elapsedSeconds: number;
  finishOrder: string[];
  phase: RacePhase;
  phaseStartedAt: number;
  raceFinishedAt: number | null;
  racers: RacerState[];
  selectedTrackIndex: number;
  winnerId: string | null;
};

export type RacerProgress = {
  distanceToNext: number;
  racer: RacerState;
  score: number;
};
