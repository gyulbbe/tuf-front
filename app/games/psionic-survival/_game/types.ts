export type Vector2 = {
  x: number;
  y: number;
};

export type GamePhase = "gameover" | "levelUp" | "playing" | "victory";

export type EnemyKind = "brute" | "crawler" | "skitter";

export type EnemyVariant = "charger" | "normal" | "shieldBreaker" | "splitter";

export type BossKind = "abyssMatron" | "mawBreaker" | "spineWeaver";

export type BossAttackKind =
  | "acidPool"
  | "charge"
  | "collapseRing"
  | "portal"
  | "shockwave"
  | "spineFan"
  | "summon"
  | "sweepBeam";

export type BossHazardKind =
  | "acidPool"
  | "chargeLane"
  | "collapseRing"
  | "portal"
  | "rotatingBeam"
  | "shockwave"
  | "spineFan";

export type UpgradeId =
  | "dimensionalRift"
  | "phaseBeam"
  | "psionicBlade"
  | "purgeNova"
  | "shieldOvercharge"
  | "timeWarp";

export type EvolutionId = "prismaticBeam" | "sanctuaryNova" | "stasisBlade";

export type UpgradeRanks = Record<UpgradeId, number>;

export type EvolvedUpgrades = Record<EvolutionId, boolean>;

export type PlayerState = {
  beamRank: number;
  bladeAngle: number;
  bladeRank: number;
  bladeTimer: number;
  fireInterval: number;
  fireTimer: number;
  hp: number;
  hurtTimer: number;
  magnetRadius: number;
  maxHp: number;
  maxShield: number;
  novaRank: number;
  novaTimer: number;
  overchargeRank: number;
  phaseBeamTimer: number;
  pos: Vector2;
  projectileDamage: number;
  projectilePierce: number;
  projectileSpeed: number;
  radius: number;
  riftRank: number;
  shield: number;
  shieldDelay: number;
  slowRank: number;
  speed: number;
  velocity: Vector2;
};

export type Enemy = {
  chargeTimer: number;
  contactTimer: number;
  damage: number;
  elite: boolean;
  hp: number;
  id: string;
  kind: EnemyKind;
  maxHp: number;
  pos: Vector2;
  radius: number;
  speed: number;
  stunTimer: number;
  velocity: Vector2;
  variant: EnemyVariant;
  wobble: number;
  xpValue: number;
};

export type Boss = {
  attackKind: BossAttackKind;
  attackTimer: number;
  contactTimer: number;
  damage: number;
  enraged: boolean;
  hp: number;
  id: string;
  kind: BossKind;
  maxHp: number;
  name: string;
  patternIndex: number;
  phaseText: string;
  pos: Vector2;
  radius: number;
  speed: number;
  stunTimer: number;
  velocity: Vector2;
  wobble: number;
  xpValue: number;
};

export type BossHazard = {
  activeSeconds: number;
  angle: number;
  arc?: number;
  bossId: string;
  color: string;
  damage: number;
  hitPlayer: boolean;
  id: string;
  innerRadius?: number;
  kind: BossHazardKind;
  length?: number;
  life: number;
  pos: Vector2;
  radius: number;
  summonKind?: EnemyKind;
  telegraphSeconds: number;
  triggered: boolean;
  ttl: number;
  width?: number;
};

export type Projectile = {
  color: string;
  damage: number;
  hitIds: string[];
  id: string;
  pierce: number;
  pos: Vector2;
  radius: number;
  trailColor: string;
  ttl: number;
  velocity: Vector2;
};

export type XpOrb = {
  id: string;
  pos: Vector2;
  radius: number;
  value: number;
  velocity: Vector2;
};

export type SanctuaryZone = {
  id: string;
  life: number;
  pos: Vector2;
  radius: number;
  ttl: number;
};

export type ParticleKind =
  | "beam"
  | "burst"
  | "nova"
  | "shockwave"
  | "spark"
  | "xpTrail";

export type Particle = {
  color: string;
  end?: Vector2;
  id: string;
  kind: ParticleKind;
  life: number;
  pos: Vector2;
  radius: number;
  ttl: number;
  velocity: Vector2;
  width?: number;
};

export type InputState = {
  down: boolean;
  left: boolean;
  pointerActive: boolean;
  pointerTarget: Vector2 | null;
  right: boolean;
  up: boolean;
};

export type UpgradeDefinition = {
  description: string;
  id: UpgradeId;
  maxRank: number;
  name: string;
  shortName: string;
};

export type UpgradeEvolution = {
  description: string;
  id: EvolutionId;
  name: string;
  primary: UpgradeId;
  secondary: UpgradeId;
  shortName: string;
};

export type UpgradeChoice =
  | {
      id: string;
      kind: "upgrade";
      upgradeId: UpgradeId;
    }
  | {
      evolutionId: EvolutionId;
      id: string;
      kind: "evolution";
    };

export type AbilityReadout = {
  cooldownRatio: number;
  evolved: boolean;
  evolutionName?: string;
  isActive: boolean;
  label: string;
  maxRank: number;
  rank: number;
  upgradeId: UpgradeId;
};

export type BossReadout = {
  enraged: boolean;
  hp: number;
  id: string;
  kind: BossKind;
  maxHp: number;
  name: string;
  phaseText: string;
};

export type RunState = {
  bossHazards: BossHazard[];
  bossQueue: BossKind[];
  bosses: Boss[];
  comboKills: number;
  comboTimer: number;
  defeatedBosses: BossKind[];
  elapsedSeconds: number;
  eliteKills: number;
  enemies: Enemy[];
  evolvedUpgrades: EvolvedUpgrades;
  gameOverReason: string;
  heat: number;
  kills: number;
  level: number;
  levelUpOptions: UpgradeChoice[];
  nextId: number;
  particles: Particle[];
  phase: GamePhase;
  player: PlayerState;
  projectiles: Projectile[];
  sanctuaryZones: SanctuaryZone[];
  spawnTimer: number;
  upgradeRanks: UpgradeRanks;
  xp: number;
  xpOrbs: XpOrb[];
  xpToNext: number;
};

export type RunSnapshot = {
  abilityReadouts: AbilityReadout[];
  bossReadouts: BossReadout[];
  bossWarning: string;
  comboKills: number;
  comboTimerRatio: number;
  defeatedBossCount: number;
  defeatedBosses: BossKind[];
  elapsedSeconds: number;
  eliteKills: number;
  enemyCount: number;
  evolvedUpgrades: EvolvedUpgrades;
  finalSurge: boolean;
  gameOverReason: string;
  heat: number;
  hp: number;
  kills: number;
  level: number;
  levelUpOptions: UpgradeChoice[];
  maxHp: number;
  maxShield: number;
  phase: GamePhase;
  shield: number;
  threatLevel: number;
  upgradeRanks: UpgradeRanks;
  xp: number;
  xpToNext: number;
};
