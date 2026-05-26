export type Vec2 = {
  x: number;
  y: number;
};

export type Rect = Vec2 & {
  height: number;
  width: number;
};

export type BlockType =
  | "breakable"
  | "crumble"
  | "high"
  | "normal"
  | "soft"
  | "wallJump";

export type Block = Rect & {
  breakSpeed?: number;
  id: string;
  motion?: SpikeMotion;
  type: BlockType;
};

export type SpikeOrientation = "up" | "down";

export type SpikeMotion = {
  axis: "x" | "y";
  max: number;
  min: number;
  phase?: number;
  speed: number;
};

export type Spike = Rect & {
  motion?: SpikeMotion;
  orientation: SpikeOrientation;
};

export type MovingRect = Rect & {
  motion?: SpikeMotion;
};

export type Target = Vec2 & {
  radius: number;
};

export type LevelDefinition = {
  blocks: Block[];
  id: number;
  name: string;
  notes: string;
  spikes: Spike[];
  start: Vec2;
  target: Target;
};

export type PlayerState = Vec2 & {
  radius: number;
  vx: number;
  vy: number;
};

export type Particle = Vec2 & {
  age: number;
  color: string;
  life: number;
  radius: number;
  vx: number;
  vy: number;
};

export type InputState = {
  left: boolean;
  right: boolean;
};

export type RunPhase = "playing" | "burst" | "clear" | "finished";

export type RunState = {
  deaths: number;
  levelIndex: number;
  message: string;
  particles: Particle[];
  phase: RunPhase;
  phaseStartedAt: number;
  player: PlayerState;
  removedBlockIds: string[];
  stageClears: number;
};
