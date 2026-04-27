import type { EnemyId } from "./enemies-config";
import type { WeaponId } from "./weapons";

export type Vec2 = {
  x: number;
  y: number;
};

export type Player = {
  pos: Vec2;
  dir: Vec2;
  plane: Vec2;
};

export type WallSide = "northSouth" | "eastWest";

export type WorldMap = readonly (readonly number[])[];

export type World = {
  decorations: Decoration[];
  enemies: Enemy[];
  exit: Exit;
  floor: number;
  healthPickups: HealthPickup[];
  impactMarks: ImpactMark[];
  lookV: number;
  map: WorldMap;
  maxFloor: number;
  pickups: Pickup[];
  player: Player;
};

export type RayHit = {
  cameraX: number;
  distance: number;
  mapX: number;
  mapY: number;
  rayDir: Vec2;
  side: WallSide;
  wallX: number;
  wallValue: number;
};

export type MovementKey = "KeyW" | "KeyA" | "KeyS" | "KeyD";

export type RunKey = "ShiftLeft" | "ShiftRight";

export type ReloadKey = "KeyR";

export type WeaponSwitchKey = "Digit1" | "Digit2" | "Digit3";

export type PauseKey = "KeyP";

export type InputKey =
  | MovementKey
  | PauseKey
  | ReloadKey
  | RunKey
  | WeaponSwitchKey;

export type EnemyState = "attack" | "chase" | "dead" | "idle";

export type Enemy = {
  deadAt?: number;
  hp: number;
  hurtFlashUntil: number;
  id: string;
  lastAttackAt: number;
  spawnedFrom?: string;
  state: EnemyState;
  type: EnemyId;
  x: number;
  y: number;
};

export type Exit = {
  radius: number;
  x: number;
  y: number;
};

export type Pickup = {
  id: string;
  taken: boolean;
  type: WeaponId;
  x: number;
  y: number;
};

export type HealthPickup = {
  amount: number;
  id: string;
  taken: boolean;
  x: number;
  y: number;
};

export type DecorationKind =
  | "barrel"
  | "box"
  | "cocoon"
  | "egg"
  | "growth"
  | "lab-panel"
  | "nest-pillar"
  | "pipe"
  | "sewer-grate"
  | "test-tube";

export type Decoration = {
  broken?: boolean;
  dropHealth?: number;
  dropWeapon?: WeaponId;
  floor: number;
  hp?: number;
  hurtFlashUntil?: number;
  id: string;
  imageKey?: string;
  kind: DecorationKind;
  scale: number;
  x: number;
  y: number;
};

export type SpriteKind =
  | "decoration"
  | "door"
  | "enemy"
  | "health"
  | "impact"
  | "pickup";

export type SpriteTextureId = 0 | 1 | 2 | 3 | 4 | 5;

export type Sprite = {
  decoration?: Decoration;
  enemy?: Enemy;
  imageKey?: string;
  kind: SpriteKind;
  label?: string;
  removeAt?: number;
  scale: number;
  textureId: SpriteTextureId;
  x: number;
  y: number;
  yOffset?: number;
};

export type ImpactMark = {
  id: string;
  removeAt: number;
  x: number;
  y: number;
};

export type KeyboardInput = {
  consumeAimTriggered: () => boolean;
  consumeFireTriggered: () => boolean;
  consumePauseTriggered: () => boolean;
  consumeReloadTriggered: () => boolean;
  consumeSwitchTriggered: () => WeaponId | null;
  dispose: () => void;
  isFiring: () => boolean;
  isRunning: () => boolean;
  isPressed: (code: MovementKey) => boolean;
  reset: () => void;
};

export type GameLoopHandle = {
  stop: () => void;
};
