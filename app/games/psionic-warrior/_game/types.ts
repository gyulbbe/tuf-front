export type Vector = {
  x: number;
  y: number;
};

export type DirectionName = "east" | "north" | "south" | "west";

export type RoomKind =
  | "boss"
  | "combat"
  | "elite"
  | "event"
  | "portal"
  | "start"
  | "treasure";

export type RoomModifier =
  | "barrage"
  | "eliteBoost"
  | "healingWell"
  | "narrow"
  | "relicCache"
  | "slowField"
  | "standard";

export type RewardKind =
  | "artifactCache"
  | "bladeResonance"
  | "healingCrystal"
  | "none"
  | "shieldCrystal";

export type EnemyKind =
  | "afterimageShard"
  | "boss"
  | "gravityNode"
  | "guardian"
  | "regenerationPriest"
  | "resonanceTurret"
  | "riftApostle"
  | "riftMine"
  | "stalker"
  | "warpLeaper";

export type BossKind =
  | "armoredJudicator"
  | "deepTuner"
  | "echoSplinterCore"
  | "gravityObserver"
  | "resonanceHierophant"
  | "riftGatekeeper"
  | "waveCrusher";

export type RoomExit = {
  direction: DirectionName;
  to: string;
};

export type Obstacle = {
  h: number;
  id: string;
  w: number;
  x: number;
  y: number;
};

export type RoomDefinition = {
  bossKind: BossKind | null;
  enemyKinds: EnemyKind[];
  exits: RoomExit[];
  gridX: number;
  gridY: number;
  id: string;
  index: number;
  kind: RoomKind;
  modifier: RoomModifier;
  obstacles: Obstacle[];
  reward: RewardKind;
};

export type FloorTuning = {
  enemyAttackBonus: number;
  enemyHealthBonus: number;
  roomCount: number;
  specialEnemyBudget: number;
};

export type DungeonDefinition = {
  floor: number;
  portalRoomId: string;
  rooms: RoomDefinition[];
  seed: string;
  startRoomId: string;
  tuning: FloorTuning;
};

export type ArtifactId =
  | "battleForesight"
  | "bladeAmplifier"
  | "desperationCircuit"
  | "dashShockwave"
  | "energyAbsorption"
  | "killBurst"
  | "piercingLance"
  | "focusedWave"
  | "phaseAcceleration"
  | "shieldRebuke"
  | "splitPrism"
  | "shieldResonance";

export type ArtifactRanks = Record<ArtifactId, number>;

export type EvolutionStage = "dualBladeAssault" | "lightbladeTrainee";

export type PlayerState = {
  artifacts: ArtifactRanks;
  attack: number;
  bladeResonance: number;
  dashCooldown: number;
  dashCooldownRemaining: number;
  dashDamage: number;
  dashUntil: number;
  dashVx: number;
  dashVy: number;
  evolution: EvolutionStage;
  fireCooldown: number;
  fireCooldownRemaining: number;
  hp: number;
  invulnerableUntil: number;
  killShieldRestore: number;
  killExplosionDamage: number;
  lastDamageAt: number;
  maxHp: number;
  maxShield: number;
  nextShotBonus: number;
  piercingShots: number;
  radius: number;
  shield: number;
  shieldRetaliationDamage: number;
  splitShotCount: number;
  speed: number;
  x: number;
  y: number;
};

export type EnemyPhase = "casting" | "lunging" | "moving" | "windup";

export type EnemyAction =
  | "bossLunge"
  | "bossNova"
  | "bossSummon"
  | "bossVolley"
  | "delayedRift"
  | "fanVolley"
  | "gravityPulse"
  | "laserSweep"
  | "mirrorClone"
  | "mineBlast"
  | "ringBurst"
  | "shockwaveLine"
  | "summonGuard"
  | "turretShot"
  | "warpSlash";

export type BossPatternId =
  | "bossLunge"
  | "delayedRift"
  | "fanVolley"
  | "gravityPulse"
  | "laserSweep"
  | "mirrorClone"
  | "ringBurst"
  | "shockwaveLine"
  | "summonGuard";

export type BossPatternState = {
  angle?: number;
  executeAt: number;
  id: BossPatternId;
  label: string;
  startedAt: number;
  targetX: number;
  targetY: number;
  telegraphUntil: number;
};

export type BossState = {
  currentPattern: BossPatternState | null;
  kind: BossKind;
  phase: number;
  phaseLogged: boolean;
};

export type EnemyState = {
  armor: number;
  action: EnemyAction | null;
  attack: number;
  boss: BossState | null;
  cooldown: number;
  dashHitUntil: number;
  hp: number;
  id: string;
  kind: EnemyKind;
  maxHp: number;
  phase: EnemyPhase;
  phaseUntil: number;
  radius: number;
  speed: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

export type ProjectileOwner = "enemy" | "player";

export type Projectile = {
  color: string;
  damage: number;
  hitEnemyIds: string[];
  id: string;
  owner: ProjectileOwner;
  pierceRemaining: number;
  radius: number;
  ttl: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

export type AttackZoneKind =
  | "bossNova"
  | "delayedRift"
  | "gravityPulse"
  | "guardianSlam"
  | "laserSweep"
  | "mineBlast"
  | "priestWell"
  | "riftBurst"
  | "shockwaveLine"
  | "slowField"
  | "warpSlash";

export type AttackZone = {
  activeUntil: number;
  angle?: number;
  damage: number;
  hasHitPlayer: boolean;
  id: string;
  kind: AttackZoneKind;
  length?: number;
  radius: number;
  strength?: number;
  sweepSpeed?: number;
  telegraphOnly?: boolean;
  telegraphUntil: number;
  width?: number;
  x: number;
  y: number;
};

export type PickupType = Exclude<RewardKind, "none">;

export type Pickup = {
  id: string;
  radius: number;
  type: PickupType;
  x: number;
  y: number;
};

export type InputState = {
  dashQueued: boolean;
  down: boolean;
  fireDown: boolean;
  fireLeft: boolean;
  fireRight: boolean;
  fireUp: boolean;
  hasPointer: boolean;
  left: boolean;
  pointerDown: boolean;
  pointerX: number;
  pointerY: number;
  right: boolean;
  up: boolean;
};

export type RunPhase = "choosingRelic" | "gameover" | "playing" | "title";

export type PendingRelicChoice = {
  options: ArtifactId[];
};

export type FloatingText = {
  color: string;
  id: string;
  text: string;
  ttl: number;
  x: number;
  y: number;
};

export type RunState = {
  attackZones: AttackZone[];
  clearedRoomIds: string[];
  currentRoomId: string;
  discoveredRoomIds: string[];
  dungeon: DungeonDefinition;
  elapsed: number;
  enemies: EnemyState[];
  floatingTexts: FloatingText[];
  floor: number;
  killCount: number;
  lastShieldLogAt: number;
  logs: string[];
  nextId: number;
  pendingRelicChoice: PendingRelicChoice | null;
  phase: RunPhase;
  piercedEnemyIds: string[];
  pickups: Pickup[];
  player: PlayerState;
  projectiles: Projectile[];
  roomRewardClaimedIds: string[];
  seed: string;
};

export type RoomSnapshot = {
  cleared: boolean;
  current: boolean;
  discovered: boolean;
  gridX: number;
  gridY: number;
  id: string;
  kind: RoomKind;
  modifier: RoomModifier;
};

export type RunSnapshot = {
  attack: number;
  artifactRanks: ArtifactRanks;
  bossHp: number | null;
  bossKind: BossKind | null;
  bossMaxHp: number | null;
  bossPatternLabel: string | null;
  bossPhase: number | null;
  currentRoomKind: RoomKind;
  currentRoomModifier: RoomModifier;
  dashCooldown: number;
  dashCooldownRemaining: number;
  enemiesRemaining: number;
  evolution: EvolutionStage;
  floor: number;
  hp: number;
  killCount: number;
  logs: string[];
  maxHp: number;
  maxShield: number;
  pendingRelicChoice: PendingRelicChoice | null;
  phase: RunPhase;
  rooms: RoomSnapshot[];
  seed: string;
  shield: number;
};
