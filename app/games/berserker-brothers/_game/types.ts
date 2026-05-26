export type Vec2 = {
  x: number;
  y: number;
};

export type Rect = Vec2 & {
  height: number;
  width: number;
};

export type PlatformKind = "dark" | "gold" | "stone";

export type Platform = Rect & {
  id: string;
  kind: PlatformKind;
};

export type RiftPad = Rect & {
  id: string;
  pairId: string;
};

export type BonusKind = "cooldown" | "gem" | "range" | "shield" | "speed";

export type CrystalCrateDefinition = Rect & {
  bonus: BonusKind;
  id: string;
};

export type EnemyKind = "boss" | "caster" | "charger" | "patrol";

export type BossTier = 1 | 2 | 3;

export type BossPattern =
  | "crossfire"
  | "dash"
  | "fan"
  | "meteor"
  | "nova"
  | "rift"
  | "summon";

export type EnemyDefinition = {
  bossTier?: BossTier;
  id: string;
  kind: EnemyKind;
  maxX: number;
  minX: number;
  name?: string;
  stageId?: number;
  threat?: number;
  x: number;
  y: number;
};

export type StageDefinition = {
  bosses: EnemyDefinition[];
  crates: CrystalCrateDefinition[];
  enemies: EnemyDefinition[];
  id: number;
  keySpawn: Vec2;
  name: string;
  pads: RiftPad[];
  platforms: Platform[];
  portal: Rect;
  reinforcements: EnemyDefinition[];
  start: Vec2;
};

export type InputState = {
  bomb: boolean;
  bombQueued: boolean;
  jump: boolean;
  jumpQueued: boolean;
  left: boolean;
  right: boolean;
  startQueued: boolean;
  up: boolean;
  use: boolean;
  useQueued: boolean;
};

export type PlayerState = {
  bombCooldown: number;
  bombCooldownScale: number;
  bombRange: number;
  carryingKey: boolean;
  facing: -1 | 1;
  height: number;
  invincibleTimer: number;
  onGround: boolean;
  padCooldown: number;
  pos: Vec2;
  shieldTimer: number;
  speedBoostTimer: number;
  velocity: Vec2;
  width: number;
};

export type Bomb = {
  fuse: number;
  id: string;
  padCooldown: number;
  pos: Vec2;
  radius: number;
  range: number;
  velocity: Vec2;
};

export type Explosion = {
  life: number;
  pos: Vec2;
  radius: number;
  ttl: number;
};

export type Enemy = {
  bossPattern: BossPattern;
  bossTier: BossTier;
  contactCooldown: number;
  dashTimer: number;
  direction: -1 | 1;
  displayName: string;
  fireCooldown: number;
  height: number;
  hitFlash: number;
  hp: number;
  id: string;
  kind: EnemyKind;
  maxHp: number;
  maxX: number;
  minX: number;
  onGround: boolean;
  pos: Vec2;
  patternCooldown: number;
  patternIndex: number;
  stageRank: number;
  summonCooldown: number;
  threat: number;
  velocity: Vec2;
  width: number;
};

export type EnemyProjectile = {
  color: string;
  id: string;
  kind: "bolt" | "needle" | "orb";
  pos: Vec2;
  radius: number;
  ttl: number;
  velocity: Vec2;
};

export type BossHazard = {
  damageWindow: number;
  height: number;
  id: string;
  kind: "pillar" | "rift" | "shockwave";
  pos: Vec2;
  radius: number;
  telegraph: number;
  ttl: number;
  width: number;
};

export type CrystalCrate = CrystalCrateDefinition & {
  hp: number;
};

export type Pickup = {
  id: string;
  kind: BonusKind;
  pos: Vec2;
  radius: number;
  ttl: number;
};

export type KeyState = {
  available: boolean;
  pos: Vec2;
};

export type Particle = {
  color: string;
  life: number;
  pos: Vec2;
  radius: number;
  ttl: number;
  velocity: Vec2;
};

export type RunPhase = "gameover" | "playing" | "stageClear" | "title" | "victory";

export type StageMode = "combat" | "keyRun";

export type RunState = {
  bossIndex: number;
  bombs: Bomb[];
  crates: CrystalCrate[];
  elapsed: number;
  enemies: Enemy[];
  explosions: Explosion[];
  hazards: BossHazard[];
  key: KeyState;
  lives: number;
  message: string;
  particles: Particle[];
  phase: RunPhase;
  phaseTimer: number;
  pickups: Pickup[];
  player: PlayerState;
  projectiles: EnemyProjectile[];
  score: number;
  stageIndex: number;
  stageMode: StageMode;
};

export type RunSnapshot = {
  bossHealthRatio: number;
  bossName: string;
  bossTier: BossTier | 0;
  bossWave: string;
  bombReady: boolean;
  keyStatus: string;
  lives: number;
  message: string;
  phase: RunPhase;
  score: number;
  shieldActive: boolean;
  stageId: number;
  stageName: string;
};
