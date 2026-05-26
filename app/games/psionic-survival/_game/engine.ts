import type {
  AbilityReadout,
  Boss,
  BossAttackKind,
  BossHazard,
  BossHazardKind,
  BossKind,
  BossReadout,
  Enemy,
  EnemyKind,
  EnemyVariant,
  EvolvedUpgrades,
  EvolutionId,
  InputState,
  Particle,
  PlayerState,
  Projectile,
  RunSnapshot,
  RunState,
  SanctuaryZone,
  UpgradeChoice,
  UpgradeDefinition,
  UpgradeEvolution,
  UpgradeId,
  UpgradeRanks,
  Vector2,
  XpOrb,
} from "./types";

export const VIEWPORT_WIDTH = 1280;
export const VIEWPORT_HEIGHT = 720;
export const FINAL_SURGE_SECONDS = 150;
export const VICTORY_SECONDS = 180;

const PLAYER_START_HP = 100;
const PLAYER_START_SHIELD = 80;
const PLAYER_SPEED = 220;
const PLAYER_RADIUS = 18;
const SHIELD_REGEN_DELAY = 2.7;
const SHIELD_REGEN_PER_SECOND = 18;
const BASE_FIRE_INTERVAL = 0.58;
const BASE_PROJECTILE_DAMAGE = 16;
const BASE_PROJECTILE_SPEED = 560;
const XP_PULL_SPEED = 460;
const MAX_PARTICLES = 260;
const COMBO_WINDOW_SECONDS = 3.2;

type BossDefinition = {
  color: string;
  damage: number;
  hp: number;
  kind: BossKind;
  name: string;
  radius: number;
  speed: number;
  xpValue: number;
};

type HostileTarget =
  | {
      boss: Boss;
      enemy?: never;
      id: string;
      kind: "boss";
      pos: Vector2;
      radius: number;
    }
  | {
      boss?: never;
      enemy: Enemy;
      id: string;
      kind: "enemy";
      pos: Vector2;
      radius: number;
    };

const BOSS_SCHEDULE: Array<{ kind: BossKind; time: number }> = [
  { kind: "mawBreaker", time: 60 },
  { kind: "spineWeaver", time: 120 },
  { kind: "abyssMatron", time: 165 },
];

export const BOSS_DEFINITIONS: Record<BossKind, BossDefinition> = {
  abyssMatron: {
    color: "#c084fc",
    damage: 21,
    hp: 1280,
    kind: "abyssMatron",
    name: "심연 모체",
    radius: 47,
    speed: 46,
    xpValue: 210,
  },
  mawBreaker: {
    color: "#fb923c",
    damage: 18,
    hp: 560,
    kind: "mawBreaker",
    name: "균열 포식체",
    radius: 42,
    speed: 62,
    xpValue: 120,
  },
  spineWeaver: {
    color: "#f472b6",
    damage: 17,
    hp: 860,
    kind: "spineWeaver",
    name: "가시 산란체",
    radius: 44,
    speed: 54,
    xpValue: 160,
  },
};

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  dimensionalRift: {
    description: "기본 광탄이 적을 더 많이 관통하고 상위 단계에서 분열 사격을 얻습니다.",
    id: "dimensionalRift",
    maxRank: 5,
    name: "차원 분열",
    shortName: "분열",
  },
  phaseBeam: {
    description: "가장 가까운 외계체를 주기적으로 꿰뚫는 청록색 위상 광선을 발사합니다.",
    id: "phaseBeam",
    maxRank: 5,
    name: "위상 광선",
    shortName: "광선",
  },
  psionicBlade: {
    description: "황금 칼날이 주변을 회전하며 근접한 적에게 반복 피해를 줍니다.",
    id: "psionicBlade",
    maxRank: 5,
    name: "사이오닉 칼날",
    shortName: "칼날",
  },
  purgeNova: {
    description: "충전된 에너지를 폭발시켜 주변 무리를 한 번에 정화합니다.",
    id: "purgeNova",
    maxRank: 5,
    name: "정화 폭발",
    shortName: "폭발",
  },
  shieldOvercharge: {
    description: "최대 보호막을 늘리고 즉시 보호막을 회복합니다.",
    id: "shieldOvercharge",
    maxRank: 5,
    name: "보호막 과충전",
    shortName: "보호막",
  },
  timeWarp: {
    description: "주변 유기체 군단의 이동 속도를 늦추는 왜곡장을 펼칩니다.",
    id: "timeWarp",
    maxRank: 5,
    name: "시간 왜곡장",
    shortName: "왜곡",
  },
};

export const EVOLUTION_DEFINITIONS: Record<EvolutionId, UpgradeEvolution> = {
  prismaticBeam: {
    description: "위상 광선이 처치 후 주변 표적에게 굴절되어 연쇄 피해를 줍니다.",
    id: "prismaticBeam",
    name: "분광 광선",
    primary: "phaseBeam",
    secondary: "dimensionalRift",
    shortName: "분광",
  },
  sanctuaryNova: {
    description: "정화 폭발 뒤에 보호막을 회복하는 성역장이 잠시 남습니다.",
    id: "sanctuaryNova",
    name: "성역 폭발",
    primary: "purgeNova",
    secondary: "shieldOvercharge",
    shortName: "성역",
  },
  stasisBlade: {
    description: "회전 칼날에 닿은 무리가 짧게 정지하며 황금 궤적에 묶입니다.",
    id: "stasisBlade",
    name: "정지 칼날",
    primary: "psionicBlade",
    secondary: "timeWarp",
    shortName: "정지",
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADE_DEFINITIONS) as UpgradeId[];
export const EVOLUTION_IDS = Object.keys(EVOLUTION_DEFINITIONS) as EvolutionId[];

export function createInputState(): InputState {
  return {
    down: false,
    left: false,
    pointerActive: false,
    pointerTarget: null,
    right: false,
    up: false,
  };
}

export function createRunState(): RunState {
  return {
    bossHazards: [],
    bossQueue: [],
    bosses: [],
    comboKills: 0,
    comboTimer: 0,
    defeatedBosses: [],
    elapsedSeconds: 0,
    eliteKills: 0,
    enemies: [],
    evolvedUpgrades: createEvolvedUpgrades(),
    gameOverReason: "",
    heat: 0,
    kills: 0,
    level: 1,
    levelUpOptions: [],
    nextId: 1,
    particles: [],
    phase: "playing",
    player: createPlayer(),
    projectiles: [],
    sanctuaryZones: [],
    spawnTimer: 0.2,
    upgradeRanks: createUpgradeRanks(),
    xp: 0,
    xpOrbs: [],
    xpToNext: getXpRequirement(1),
  };
}

export function createRunSnapshot(state: RunState): RunSnapshot {
  return {
    abilityReadouts: createAbilityReadouts(state),
    bossReadouts: createBossReadouts(state),
    bossWarning: getBossWarning(state),
    comboKills: state.comboKills,
    comboTimerRatio: clamp01(state.comboTimer / COMBO_WINDOW_SECONDS),
    defeatedBossCount: state.defeatedBosses.length,
    defeatedBosses: [...state.defeatedBosses],
    elapsedSeconds: state.elapsedSeconds,
    eliteKills: state.eliteKills,
    enemyCount: state.enemies.length,
    evolvedUpgrades: { ...state.evolvedUpgrades },
    finalSurge: state.elapsedSeconds >= FINAL_SURGE_SECONDS,
    gameOverReason: state.gameOverReason,
    heat: Math.round(state.heat),
    hp: Math.ceil(state.player.hp),
    kills: state.kills,
    level: state.level,
    levelUpOptions: state.levelUpOptions.map((choice) => ({ ...choice })),
    maxHp: state.player.maxHp,
    maxShield: state.player.maxShield,
    phase: state.phase,
    shield: Math.ceil(state.player.shield),
    threatLevel: getThreatLevel(state),
    upgradeRanks: { ...state.upgradeRanks },
    xp: Math.floor(state.xp),
    xpToNext: state.xpToNext,
  };
}

export function stepRun(
  state: RunState,
  input: InputState,
  rawDeltaSeconds: number,
): RunState {
  const deltaSeconds = Math.min(Math.max(rawDeltaSeconds, 0), 0.05);

  if (state.phase !== "playing") {
    updateParticles(state, deltaSeconds);
    updateSanctuaryZones(state, deltaSeconds);
    updateBossHazards(state, deltaSeconds);
    return state;
  }

  state.elapsedSeconds += deltaSeconds;
  updateCombo(state, deltaSeconds);
  updateParticles(state, deltaSeconds);
  updateSanctuaryZones(state, deltaSeconds);
  updateBossSchedule(state);
  updatePlayer(state, input, deltaSeconds);
  updateBosses(state, deltaSeconds);
  updateBossHazards(state, deltaSeconds);
  updateWeapons(state, deltaSeconds);
  spawnEnemies(state, deltaSeconds);
  updateEnemies(state, deltaSeconds);

  if (state.phase !== "playing") {
    return state;
  }

  updateProjectiles(state, deltaSeconds);
  updateExperienceOrbs(state, deltaSeconds);

  if (state.elapsedSeconds >= VICTORY_SECONDS) {
    state.phase = "victory";
    state.gameOverReason = "3분 공세를 버텨내고 전장의 차원 회로를 안정화했습니다.";
    return state;
  }

  checkLevelUp(state);
  return state;
}

export function chooseUpgrade(state: RunState, choice: UpgradeChoice): RunState {
  if (
    state.phase !== "levelUp" ||
    !state.levelUpOptions.some((option) => option.id === choice.id)
  ) {
    return state;
  }

  if (choice.kind === "evolution") {
    applyEvolution(state, choice.evolutionId);
  } else {
    const upgradeId = choice.upgradeId;
    const nextRank = Math.min(
      UPGRADE_DEFINITIONS[upgradeId].maxRank,
      state.upgradeRanks[upgradeId] + 1,
    );

    state.upgradeRanks[upgradeId] = nextRank;
    applyUpgrade(state.player, upgradeId, nextRank);
  }

  state.levelUpOptions = [];
  state.phase = "playing";
  return state;
}

export function getBladeRadius(player: PlayerState): number {
  return player.bladeRank > 0 ? 72 + player.bladeRank * 13 : 0;
}

export function getSlowAuraRadius(player: PlayerState): number {
  return player.slowRank > 0 ? 124 + player.slowRank * 24 : 0;
}

export function getNovaRadius(player: PlayerState): number {
  return player.novaRank > 0 ? 140 + player.novaRank * 24 : 0;
}

function createPlayer(): PlayerState {
  return {
    beamRank: 0,
    bladeAngle: 0,
    bladeRank: 0,
    bladeTimer: 0,
    fireInterval: BASE_FIRE_INTERVAL,
    fireTimer: 0.15,
    hp: PLAYER_START_HP,
    hurtTimer: 0,
    magnetRadius: 94,
    maxHp: PLAYER_START_HP,
    maxShield: PLAYER_START_SHIELD,
    novaRank: 0,
    novaTimer: 4.8,
    overchargeRank: 0,
    phaseBeamTimer: 0.7,
    pos: { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 },
    projectileDamage: BASE_PROJECTILE_DAMAGE,
    projectilePierce: 0,
    projectileSpeed: BASE_PROJECTILE_SPEED,
    radius: PLAYER_RADIUS,
    riftRank: 0,
    shield: PLAYER_START_SHIELD,
    shieldDelay: SHIELD_REGEN_DELAY,
    slowRank: 0,
    speed: PLAYER_SPEED,
    velocity: { x: 0, y: 0 },
  };
}

function createUpgradeRanks(): UpgradeRanks {
  return {
    dimensionalRift: 0,
    phaseBeam: 0,
    psionicBlade: 0,
    purgeNova: 0,
    shieldOvercharge: 0,
    timeWarp: 0,
  };
}

function createEvolvedUpgrades(): EvolvedUpgrades {
  return {
    prismaticBeam: false,
    sanctuaryNova: false,
    stasisBlade: false,
  };
}

function createAbilityReadouts(state: RunState): AbilityReadout[] {
  return UPGRADE_IDS.map((upgradeId) => {
    const definition = UPGRADE_DEFINITIONS[upgradeId];
    const rank = state.upgradeRanks[upgradeId];
    const evolution = findPrimaryEvolution(upgradeId);
    const evolved = evolution ? state.evolvedUpgrades[evolution.id] : false;

    return {
      cooldownRatio: getCooldownRatio(state.player, upgradeId),
      evolved,
      evolutionName: evolved && evolution ? evolution.shortName : undefined,
      isActive: rank > 0,
      label: definition.shortName,
      maxRank: definition.maxRank,
      rank,
      upgradeId,
    };
  });
}

function createBossReadouts(state: RunState): BossReadout[] {
  return state.bosses.map((boss) => ({
    enraged: boss.enraged,
    hp: Math.ceil(boss.hp),
    id: boss.id,
    kind: boss.kind,
    maxHp: boss.maxHp,
    name: boss.name,
    phaseText: boss.phaseText,
  }));
}

function getBossWarning(state: RunState): string {
  const telegraph = state.bossHazards.find(
    (hazard) => hazard.life < hazard.telegraphSeconds,
  );

  if (telegraph) {
    return getHazardWarning(telegraph.kind);
  }

  if (state.bosses.length > 0) {
    const boss = state.bosses[0];
    return boss.enraged ? `${boss.name} 광폭화` : boss.phaseText;
  }

  if (state.bossQueue.length > 0) {
    return `${BOSS_DEFINITIONS[state.bossQueue[0]].name} 대기 중`;
  }

  const nextBoss = BOSS_SCHEDULE.find(
    (entry) => !hasBossBeenScheduled(state, entry.kind),
  );

  if (!nextBoss) {
    return "";
  }

  const remaining = Math.ceil(nextBoss.time - state.elapsedSeconds);
  return remaining > 0 ? `${BOSS_DEFINITIONS[nextBoss.kind].name} ${remaining}초 후 출현` : "";
}

function getHazardWarning(kind: BossHazardKind): string {
  if (kind === "chargeLane") return "돌진 차선 감지";
  if (kind === "shockwave") return "충격파 전개";
  if (kind === "spineFan") return "가시 부채꼴 산란";
  if (kind === "acidPool") return "산성 장판 낙하";
  if (kind === "rotatingBeam") return "회전 광역선 충전";
  if (kind === "collapseRing") return "붕괴 고리 수축";
  return "군단 관문 개방";
}

function getCooldownRatio(player: PlayerState, upgradeId: UpgradeId): number {
  if (upgradeId === "psionicBlade") {
    const interval = Math.max(0.12, 0.24 - player.bladeRank * 0.018);
    return player.bladeRank > 0 ? clamp01(1 - player.bladeTimer / interval) : 0;
  }

  if (upgradeId === "phaseBeam") {
    const interval = Math.max(0.34, 0.88 - player.beamRank * 0.07);
    return player.beamRank > 0 ? clamp01(1 - player.phaseBeamTimer / interval) : 0;
  }

  if (upgradeId === "purgeNova") {
    const interval = Math.max(2.8, 5.8 - player.novaRank * 0.45);
    return player.novaRank > 0 ? clamp01(1 - player.novaTimer / interval) : 0;
  }

  return getPlayerRank(player, upgradeId) > 0 ? 1 : 0;
}

function getPlayerRank(player: PlayerState, upgradeId: UpgradeId): number {
  if (upgradeId === "dimensionalRift") return player.riftRank;
  if (upgradeId === "phaseBeam") return player.beamRank;
  if (upgradeId === "psionicBlade") return player.bladeRank;
  if (upgradeId === "purgeNova") return player.novaRank;
  if (upgradeId === "shieldOvercharge") return player.overchargeRank;
  return player.slowRank;
}

function updateCombo(state: RunState, deltaSeconds: number) {
  state.comboTimer = Math.max(0, state.comboTimer - deltaSeconds);

  if (state.comboTimer === 0) {
    state.comboKills = 0;
    state.heat = Math.max(0, state.heat - deltaSeconds * 7);
  } else {
    state.heat = Math.max(0, state.heat - deltaSeconds * 2.5);
  }
}

function updatePlayer(state: RunState, input: InputState, deltaSeconds: number) {
  const player = state.player;
  const keyboardDirection = normalize({
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  });
  let direction = keyboardDirection;

  if (length(direction) === 0 && input.pointerActive && input.pointerTarget) {
    const pointerVector = subtract(input.pointerTarget, player.pos);
    direction = length(pointerVector) > 8 ? normalize(pointerVector) : { x: 0, y: 0 };
  }

  const heatSpeedBonus = 1 + Math.min(0.1, state.heat / 1100);
  player.velocity = multiply(direction, player.speed * heatSpeedBonus);
  player.pos = clampToArena(add(player.pos, multiply(player.velocity, deltaSeconds)), player.radius);
  player.hurtTimer = Math.max(0, player.hurtTimer - deltaSeconds);
  player.shieldDelay += deltaSeconds;

  if (player.shieldDelay >= SHIELD_REGEN_DELAY && player.shield < player.maxShield) {
    player.shield = Math.min(
      player.maxShield,
      player.shield + SHIELD_REGEN_PER_SECOND * deltaSeconds,
    );
  }
}

function updateWeapons(state: RunState, deltaSeconds: number) {
  const player = state.player;

  player.bladeAngle += deltaSeconds * (2.8 + player.bladeRank * 0.24);
  player.fireTimer -= deltaSeconds;
  player.phaseBeamTimer -= deltaSeconds;
  player.bladeTimer -= deltaSeconds;
  player.novaTimer -= deltaSeconds;

  if (player.fireTimer <= 0) {
    fireBasicProjectiles(state);
    player.fireTimer = Math.max(0.25, player.fireInterval - player.riftRank * 0.026);
  }

  if (player.bladeRank > 0 && player.bladeTimer <= 0) {
    resolveBladeStrike(state);
    player.bladeTimer = Math.max(0.11, 0.24 - player.bladeRank * 0.018);
  }

  if (player.beamRank > 0 && player.phaseBeamTimer <= 0) {
    firePhaseBeam(state);
    player.phaseBeamTimer = Math.max(0.3, 0.88 - player.beamRank * 0.07);
  }

  if (player.novaRank > 0 && player.novaTimer <= 0) {
    releasePurgeNova(state);
    player.novaTimer = Math.max(2.55, 5.8 - player.novaRank * 0.45);
  }
}

function fireBasicProjectiles(state: RunState) {
  const player = state.player;
  const target = findNearestHostile(state, player.pos, 700, []);

  if (!target) {
    return;
  }

  const baseAngle = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
  const shotCount = player.riftRank >= 4 ? 3 : player.riftRank >= 2 ? 2 : 1;
  const offsets = shotCount === 3 ? [-0.18, 0, 0.18] : shotCount === 2 ? [-0.09, 0.09] : [0];

  offsets.forEach((offset) => {
    const angle = baseAngle + offset;
    const velocity = {
      x: Math.cos(angle) * player.projectileSpeed,
      y: Math.sin(angle) * player.projectileSpeed,
    };

    state.projectiles.push({
      color: player.riftRank > 0 ? "#67e8f9" : "#facc15",
      damage: player.projectileDamage + player.riftRank * 2,
      hitIds: [],
      id: nextId(state, "shot"),
      pierce: player.projectilePierce,
      pos: add(player.pos, multiply(normalize(velocity), player.radius + 8)),
      radius: 5,
      trailColor: player.riftRank > 0 ? "rgba(34,211,238,0.35)" : "rgba(250,204,21,0.35)",
      ttl: 1.65,
      velocity,
    });
  });
}

function resolveBladeStrike(state: RunState) {
  const player = state.player;
  const radius = getBladeRadius(player);
  const evolved = state.evolvedUpgrades.stasisBlade;
  const damage = 8 + player.bladeRank * 6 + (evolved ? 6 : 0);

  state.enemies
    .filter((enemy) => distance(enemy.pos, player.pos) <= radius + enemy.radius)
    .forEach((enemy) => {
      if (evolved) {
        enemy.stunTimer = Math.max(enemy.stunTimer, 0.55 + player.bladeRank * 0.04);
      }

      damageEnemy(state, enemy, damage, evolved ? "#a7f3d0" : "#fef08a");
    });
  state.bosses
    .filter((boss) => distance(boss.pos, player.pos) <= radius + boss.radius)
    .forEach((boss) => {
      if (evolved) {
        boss.stunTimer = Math.max(boss.stunTimer, 0.28);
      }

      damageBoss(state, boss, damage * 0.56, evolved ? "#a7f3d0" : "#fef08a");
    });
}

function firePhaseBeam(state: RunState) {
  const player = state.player;
  const target = findNearestHostile(state, player.pos, 560 + player.beamRank * 36, []);

  if (!target) {
    return;
  }

  const damage = 12 + player.beamRank * 8;
  const killed = damageHostile(state, target, damage, "#22d3ee");
  addBeam(state, player.pos, target.pos, "#67e8f9", 4 + player.beamRank * 0.7);

  if (!state.evolvedUpgrades.prismaticBeam) {
    return;
  }

  const excluded = [target.id];
  let chainOrigin = { ...target.pos };
  let canChain = killed || player.beamRank >= 5;

  for (let index = 0; index < 3 && canChain; index += 1) {
    const nextTarget = findNearestHostile(state, chainOrigin, 360, excluded);

    if (!nextTarget) {
      return;
    }

    excluded.push(nextTarget.id);
    addBeam(state, chainOrigin, nextTarget.pos, index % 2 === 0 ? "#c4b5fd" : "#67e8f9", 3.4);
    canChain = damageHostile(state, nextTarget, damage * (0.72 - index * 0.1), "#c4b5fd");
    chainOrigin = { ...nextTarget.pos };
  }
}

function releasePurgeNova(state: RunState) {
  const player = state.player;
  const radius = getNovaRadius(player);
  const evolved = state.evolvedUpgrades.sanctuaryNova;
  const damage = 22 + player.novaRank * 13 + (evolved ? 8 : 0);

  addParticle(state, {
    color: evolved ? "#a7f3d0" : "#facc15",
    kind: "nova",
    pos: { ...player.pos },
    radius,
    ttl: 0.58,
    velocity: { x: 0, y: 0 },
    width: evolved ? 10 : 7,
  });
  addParticle(state, {
    color: "#67e8f9",
    kind: "shockwave",
    pos: { ...player.pos },
    radius: radius * 0.72,
    ttl: 0.48,
    velocity: { x: 0, y: 0 },
    width: 3,
  });

  state.enemies
    .filter((enemy) => distance(enemy.pos, player.pos) <= radius + enemy.radius)
    .forEach((enemy) => damageEnemy(state, enemy, damage, evolved ? "#bbf7d0" : "#fde68a"));
  state.bosses
    .filter((boss) => distance(boss.pos, player.pos) <= radius + boss.radius)
    .forEach((boss) => damageBoss(state, boss, damage * 0.72, evolved ? "#bbf7d0" : "#fde68a"));

  if (evolved) {
    state.sanctuaryZones.push({
      id: nextId(state, "sanctuary"),
      life: 0,
      pos: { ...player.pos },
      radius: radius * 0.62,
      ttl: 5.2,
    });
  }
}

function updateSanctuaryZones(state: RunState, deltaSeconds: number) {
  const player = state.player;
  const remainingZones: SanctuaryZone[] = [];

  state.sanctuaryZones.forEach((zone) => {
    const nextZone = {
      ...zone,
      life: zone.life + deltaSeconds,
      ttl: zone.ttl - deltaSeconds,
    };

    if (
      state.phase === "playing" &&
      nextZone.ttl > 0 &&
      distance(player.pos, nextZone.pos) <= nextZone.radius + player.radius
    ) {
      player.shield = Math.min(player.maxShield, player.shield + 22 * deltaSeconds);
      player.hp = Math.min(player.maxHp, player.hp + 4 * deltaSeconds);
    }

    if (nextZone.ttl > 0) {
      remainingZones.push(nextZone);
    }
  });

  state.sanctuaryZones = remainingZones;
}

function updateBossSchedule(state: RunState) {
  if (state.bosses.length === 0 && state.bossQueue.length > 0) {
    const nextBoss = state.bossQueue.shift();

    if (nextBoss) {
      spawnBoss(state, nextBoss);
    }
  }

  BOSS_SCHEDULE.forEach((entry) => {
    if (state.elapsedSeconds < entry.time || hasBossBeenScheduled(state, entry.kind)) {
      return;
    }

    if (state.bosses.length > 0) {
      state.bossQueue.push(entry.kind);
    } else {
      spawnBoss(state, entry.kind);
    }
  });

  if (state.bosses.length === 0 && state.bossQueue.length > 0) {
    const nextBoss = state.bossQueue.shift();

    if (nextBoss) {
      spawnBoss(state, nextBoss);
    }
  }
}

function hasBossBeenScheduled(state: RunState, kind: BossKind): boolean {
  return (
    state.defeatedBosses.includes(kind) ||
    state.bossQueue.includes(kind) ||
    state.bosses.some((boss) => boss.kind === kind)
  );
}

function spawnBoss(state: RunState, kind: BossKind) {
  const definition = BOSS_DEFINITIONS[kind];
  const entrySide = Math.floor(Math.random() * 4);
  const pos =
    entrySide === 0
      ? { x: VIEWPORT_WIDTH * 0.5, y: -definition.radius - 20 }
      : entrySide === 1
        ? { x: VIEWPORT_WIDTH + definition.radius + 20, y: VIEWPORT_HEIGHT * 0.5 }
        : entrySide === 2
          ? { x: VIEWPORT_WIDTH * 0.5, y: VIEWPORT_HEIGHT + definition.radius + 20 }
          : { x: -definition.radius - 20, y: VIEWPORT_HEIGHT * 0.5 };
  const timeScale = 1 + Math.max(0, state.elapsedSeconds - 60) / 260;
  const boss: Boss = {
    attackKind: "summon",
    attackTimer: 2.2,
    contactTimer: 0,
    damage: definition.damage,
    enraged: false,
    hp: Math.round(definition.hp * timeScale),
    id: nextId(state, kind),
    kind,
    maxHp: Math.round(definition.hp * timeScale),
    name: definition.name,
    patternIndex: 0,
    phaseText: "전장 진입",
    pos,
    radius: definition.radius,
    speed: definition.speed,
    stunTimer: 0,
    velocity: { x: 0, y: 0 },
    wobble: Math.random() * Math.PI * 2,
    xpValue: definition.xpValue,
  };

  state.bosses.push(boss);
  addParticle(state, {
    color: definition.color,
    kind: "nova",
    pos: clampToArena(pos, definition.radius),
    radius: 210,
    ttl: 0.72,
    velocity: { x: 0, y: 0 },
    width: 10,
  });
}

function updateBosses(state: RunState, deltaSeconds: number) {
  const player = state.player;

  state.bosses.forEach((boss) => {
    const toPlayer = subtract(player.pos, boss.pos);
    const bossDistance = length(toPlayer);
    const direction = bossDistance > 0 ? multiply(toPlayer, 1 / bossDistance) : { x: 0, y: 0 };
    const slowRadius = getSlowAuraRadius(player);
    const slowed = slowRadius > 0 && bossDistance < slowRadius;
    const slowMultiplier = slowed ? 0.72 : 1;
    const enraged = boss.hp / boss.maxHp <= 0.35;
    const stunMultiplier = boss.stunTimer > 0 ? 0.28 : 1;

    boss.enraged = enraged;
    boss.contactTimer = Math.max(0, boss.contactTimer - deltaSeconds);
    boss.stunTimer = Math.max(0, boss.stunTimer - deltaSeconds);
    boss.attackTimer -= deltaSeconds;
    boss.wobble += deltaSeconds * (enraged ? 4.4 : 2.6);
    boss.velocity = multiply(
      direction,
      boss.speed * slowMultiplier * stunMultiplier * (enraged ? 1.12 : 1),
    );
    boss.pos = clampToArena(add(boss.pos, multiply(boss.velocity, deltaSeconds)), boss.radius);

    if (
      bossDistance <= boss.radius + player.radius &&
      boss.contactTimer <= 0 &&
      player.hurtTimer <= 0
    ) {
      damagePlayerFromAmount(state, boss.damage, boss.kind === "abyssMatron" ? 0.18 : 0);
      boss.contactTimer = 0.72;
    }

    if (boss.attackTimer <= 0) {
      triggerBossAttack(state, boss);
      boss.attackTimer = getBossAttackInterval(boss);
    }
  });
}

function triggerBossAttack(state: RunState, boss: Boss) {
  if (boss.kind === "mawBreaker") {
    triggerMawBreakerAttack(state, boss);
  } else if (boss.kind === "spineWeaver") {
    triggerSpineWeaverAttack(state, boss);
  } else {
    triggerAbyssMatronAttack(state, boss);
  }

  boss.patternIndex += 1;
}

function triggerMawBreakerAttack(state: RunState, boss: Boss) {
  const pattern = boss.patternIndex % 3;

  if (pattern === 0) {
    boss.attackKind = "charge";
    boss.phaseText = "균열 돌진";
    addBossHazard(state, {
      angle: Math.atan2(state.player.pos.y - boss.pos.y, state.player.pos.x - boss.pos.x),
      bossId: boss.id,
      color: "#fb923c",
      damage: boss.damage * 1.35,
      kind: "chargeLane",
      length: 560,
      pos: { ...boss.pos },
      radius: 0,
      telegraphSeconds: boss.enraged ? 0.55 : 0.78,
      width: 72,
    });
  } else if (pattern === 1) {
    boss.attackKind = "shockwave";
    boss.phaseText = "턱 충격파";
    addBossHazard(state, {
      angle: 0,
      bossId: boss.id,
      color: "#f97316",
      damage: boss.damage * 1.08,
      kind: "shockwave",
      pos: { ...boss.pos },
      radius: boss.enraged ? 210 : 178,
      telegraphSeconds: boss.enraged ? 0.58 : 0.82,
      width: 22,
    });
  } else {
    boss.attackKind = "summon";
    boss.phaseText = "포식 무리 호출";
    spawnBossMinions(state, boss, "crawler", boss.enraged ? 7 : 5);
  }
}

function triggerSpineWeaverAttack(state: RunState, boss: Boss) {
  const pattern = boss.patternIndex % 3;

  if (pattern === 0) {
    boss.attackKind = "spineFan";
    boss.phaseText = "가시 부채꼴";
    addBossHazard(state, {
      angle: Math.atan2(state.player.pos.y - boss.pos.y, state.player.pos.x - boss.pos.x),
      arc: boss.enraged ? 1.12 : 0.92,
      bossId: boss.id,
      color: "#f472b6",
      damage: boss.damage,
      kind: "spineFan",
      pos: { ...boss.pos },
      radius: boss.enraged ? 410 : 350,
      telegraphSeconds: boss.enraged ? 0.62 : 0.9,
      width: 34,
    });
  } else if (pattern === 1) {
    boss.attackKind = "acidPool";
    boss.phaseText = "산성 낙하";
    addBossHazard(state, {
      angle: 0,
      bossId: boss.id,
      color: "#a3e635",
      damage: boss.damage * 0.88,
      kind: "acidPool",
      pos: { ...state.player.pos },
      radius: boss.enraged ? 92 : 76,
      telegraphSeconds: boss.enraged ? 0.68 : 0.95,
      width: 0,
    });
  } else {
    boss.attackKind = "portal";
    boss.phaseText = "분열 알 산란";
    addBossHazard(state, {
      angle: 0,
      bossId: boss.id,
      color: "#c084fc",
      damage: 0,
      kind: "portal",
      pos: randomNearPlayer(state.player.pos, 210),
      radius: boss.enraged ? 70 : 58,
      summonKind: "skitter",
      telegraphSeconds: 1.05,
      width: 0,
    });
  }
}

function triggerAbyssMatronAttack(state: RunState, boss: Boss) {
  const pattern = boss.patternIndex % 3;

  if (pattern === 0) {
    boss.attackKind = "sweepBeam";
    boss.phaseText = "심연 회전선";
    addBossHazard(state, {
      angle: Math.atan2(state.player.pos.y - boss.pos.y, state.player.pos.x - boss.pos.x),
      bossId: boss.id,
      color: "#c084fc",
      damage: boss.damage * 1.05,
      kind: "rotatingBeam",
      length: 760,
      pos: { ...boss.pos },
      radius: 0,
      telegraphSeconds: boss.enraged ? 0.72 : 1,
      width: boss.enraged ? 48 : 40,
    });
  } else if (pattern === 1) {
    boss.attackKind = "collapseRing";
    boss.phaseText = "붕괴 고리";
    addBossHazard(state, {
      angle: 0,
      bossId: boss.id,
      color: "#a78bfa",
      damage: boss.damage,
      innerRadius: 72,
      kind: "collapseRing",
      pos: { ...state.player.pos },
      radius: boss.enraged ? 260 : 220,
      telegraphSeconds: boss.enraged ? 0.72 : 1.05,
      width: 28,
    });
  } else {
    boss.attackKind = "portal";
    boss.phaseText = "군단 관문";
    addBossHazard(state, {
      angle: 0,
      bossId: boss.id,
      color: "#7c3aed",
      damage: boss.damage * 0.35,
      kind: "portal",
      pos: randomNearPlayer(state.player.pos, 260),
      radius: boss.enraged ? 88 : 72,
      summonKind: "crawler",
      telegraphSeconds: 1.1,
      width: 0,
    });
  }
}

function getBossAttackInterval(boss: Boss): number {
  const base =
    boss.kind === "mawBreaker"
      ? 3.5
      : boss.kind === "spineWeaver"
        ? 3.1
        : 2.8;

  return boss.enraged ? base * 0.74 : base;
}

function addBossHazard(
  state: RunState,
  hazard: Omit<BossHazard, "activeSeconds" | "hitPlayer" | "id" | "life" | "triggered" | "ttl">,
) {
  const activeSeconds = getHazardActiveSeconds(hazard.kind);

  state.bossHazards.push({
    ...hazard,
    activeSeconds,
    hitPlayer: false,
    id: nextId(state, `hazard-${hazard.kind}`),
    life: 0,
    triggered: false,
    ttl: hazard.telegraphSeconds + activeSeconds,
  });
}

function getHazardActiveSeconds(kind: BossHazardKind): number {
  if (kind === "acidPool") return 4.2;
  if (kind === "rotatingBeam") return 2.3;
  if (kind === "collapseRing") return 1.45;
  if (kind === "portal") return 2.2;
  return 0.52;
}

function updateBossHazards(state: RunState, deltaSeconds: number) {
  const remainingHazards: BossHazard[] = [];

  state.bossHazards.forEach((hazard) => {
    const nextHazard = {
      ...hazard,
      life: hazard.life + deltaSeconds,
      ttl: hazard.ttl - deltaSeconds,
    };
    const active = nextHazard.life >= nextHazard.telegraphSeconds;

    if (active && !nextHazard.triggered) {
      triggerBossHazard(state, nextHazard);
      nextHazard.triggered = true;
    }

    if (active && state.phase === "playing") {
      resolveBossHazardHit(state, nextHazard, deltaSeconds);
    }

    if (nextHazard.ttl > 0) {
      remainingHazards.push(nextHazard);
    }
  });

  state.bossHazards = remainingHazards;
}

function triggerBossHazard(state: RunState, hazard: BossHazard) {
  if (hazard.kind === "portal") {
    const count = hazard.radius >= 80 ? 5 : 3;

    for (let index = 0; index < count; index += 1) {
      const child = createEnemy(state, hazard.summonKind ?? "crawler", index === 0 ? "splitter" : "normal");
      const angle = (Math.PI * 2 * index) / count;
      child.pos = add(hazard.pos, {
        x: Math.cos(angle) * hazard.radius * 0.58,
        y: Math.sin(angle) * hazard.radius * 0.58,
      });
      child.hp = Math.round(child.hp * 0.72);
      child.maxHp = child.hp;
      state.enemies.push(child);
    }
  }

  addParticle(state, {
    color: hazard.color,
    kind: hazard.kind === "portal" ? "nova" : "shockwave",
    pos: { ...hazard.pos },
    radius: hazard.radius || (hazard.length ?? 160) * 0.32,
    ttl: 0.52,
    velocity: { x: 0, y: 0 },
    width: hazard.width ?? 6,
  });
}

function resolveBossHazardHit(state: RunState, hazard: BossHazard, deltaSeconds: number) {
  if (hazard.kind === "portal" && hazard.damage <= 0) {
    return;
  }

  const repeatable = hazard.kind === "acidPool" || hazard.kind === "rotatingBeam";

  if (hazard.hitPlayer && !repeatable) {
    return;
  }

  if (!isPlayerInsideHazard(state.player.pos, state.player.radius, hazard)) {
    return;
  }

  damagePlayerFromAmount(state, repeatable ? hazard.damage * deltaSeconds * 1.35 : hazard.damage);
  hazard.hitPlayer = true;
}

function isPlayerInsideHazard(playerPos: Vector2, playerRadius: number, hazard: BossHazard): boolean {
  if (hazard.kind === "chargeLane") {
    return isPointInLane(playerPos, hazard.pos, hazard.angle, hazard.length ?? 480, (hazard.width ?? 64) / 2 + playerRadius);
  }

  if (hazard.kind === "spineFan") {
    const toPlayer = subtract(playerPos, hazard.pos);
    const playerDistance = length(toPlayer);
    const angle = Math.atan2(toPlayer.y, toPlayer.x);
    return (
      playerDistance <= hazard.radius + playerRadius &&
      Math.abs(angleDifference(angle, hazard.angle)) <= (hazard.arc ?? 0.9) / 2
    );
  }

  if (hazard.kind === "rotatingBeam") {
    const activeProgress = clamp01(
      (hazard.life - hazard.telegraphSeconds) / Math.max(0.01, hazard.activeSeconds),
    );
    const angle = hazard.angle + activeProgress * Math.PI * 1.38;
    return (
      isPointInLane(playerPos, hazard.pos, angle, hazard.length ?? 700, (hazard.width ?? 40) / 2 + playerRadius) ||
      isPointInLane(
        playerPos,
        hazard.pos,
        angle + Math.PI,
        hazard.length ?? 700,
        (hazard.width ?? 40) / 2 + playerRadius,
      )
    );
  }

  if (hazard.kind === "collapseRing") {
    const activeProgress = clamp01(
      (hazard.life - hazard.telegraphSeconds) / Math.max(0.01, hazard.activeSeconds),
    );
    const radius = (hazard.innerRadius ?? 70) + (hazard.radius - (hazard.innerRadius ?? 70)) * activeProgress;
    return Math.abs(distance(playerPos, hazard.pos) - radius) <= (hazard.width ?? 24) + playerRadius;
  }

  return distance(playerPos, hazard.pos) <= hazard.radius + playerRadius;
}

function isPointInLane(
  point: Vector2,
  origin: Vector2,
  angle: number,
  lengthValue: number,
  halfWidth: number,
): boolean {
  const toPoint = subtract(point, origin);
  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const projection = toPoint.x * forward.x + toPoint.y * forward.y;
  const perpendicular = Math.abs(toPoint.x * -forward.y + toPoint.y * forward.x);

  return projection >= 0 && projection <= lengthValue && perpendicular <= halfWidth;
}

function spawnBossMinions(
  state: RunState,
  boss: Boss,
  kind: EnemyKind,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + boss.wobble;
    const minion = createEnemy(state, kind, "normal");

    minion.pos = add(boss.pos, {
      x: Math.cos(angle) * (boss.radius + 42),
      y: Math.sin(angle) * (boss.radius + 42),
    });
    minion.hp = Math.round(minion.hp * 0.8);
    minion.maxHp = minion.hp;
    state.enemies.push(minion);
  }
}

function randomNearPlayer(playerPos: Vector2, radius: number): Vector2 {
  const angle = Math.random() * Math.PI * 2;
  const spread = 80 + Math.random() * radius;

  return clampToArena(
    {
      x: playerPos.x + Math.cos(angle) * spread,
      y: playerPos.y + Math.sin(angle) * spread,
    },
    80,
  );
}

function spawnEnemies(state: RunState, deltaSeconds: number) {
  const difficulty = getDifficulty(state.elapsedSeconds, state.bosses.length > 0);

  state.spawnTimer -= deltaSeconds;

  while (state.spawnTimer <= 0 && state.enemies.length < difficulty.maxEnemies) {
    for (
      let index = 0;
      index < difficulty.batchSize && state.enemies.length < difficulty.maxEnemies;
      index += 1
    ) {
      const kind = pickEnemyKind(state.elapsedSeconds);
      const variant = pickEnemyVariant(state.elapsedSeconds);
      state.enemies.push(createEnemy(state, kind, variant));
    }

    state.spawnTimer += difficulty.spawnInterval;
  }
}

function createEnemy(state: RunState, kind: EnemyKind, variant: EnemyVariant): Enemy {
  const difficulty = getDifficulty(state.elapsedSeconds, state.bosses.length > 0);
  const healthScale = 1 + state.elapsedSeconds / 150 + (state.elapsedSeconds > 90 ? 0.18 : 0);
  const speedScale = 1 + Math.min(0.55, state.elapsedSeconds / 360);
  const base = getEnemyBase(kind);
  const elite = variant !== "normal";
  const variantStats = getVariantStats(variant);
  const hp = Math.round(base.hp * healthScale * variantStats.hpScale);

  return {
    chargeTimer: 0.8 + Math.random() * 2.2,
    contactTimer: 0,
    damage: Math.round((base.damage + difficulty.damageBonus) * variantStats.damageScale),
    elite,
    hp,
    id: nextId(state, elite ? variant : kind),
    kind,
    maxHp: hp,
    pos: randomEdgePosition(),
    radius: base.radius * variantStats.radiusScale,
    speed: base.speed * speedScale * variantStats.speedScale,
    stunTimer: 0,
    velocity: { x: 0, y: 0 },
    variant,
    wobble: Math.random() * Math.PI * 2,
    xpValue: Math.round(base.xpValue * variantStats.xpScale),
  };
}

function updateEnemies(state: RunState, deltaSeconds: number) {
  const player = state.player;
  const slowRadius = getSlowAuraRadius(player);
  const slowMultiplier = player.slowRank > 0 ? Math.max(0.42, 0.86 - player.slowRank * 0.08) : 1;

  state.enemies.forEach((enemy) => {
    const toPlayer = subtract(player.pos, enemy.pos);
    const enemyDistance = length(toPlayer);
    const slowed = slowRadius > 0 && enemyDistance < slowRadius;
    const direction = enemyDistance > 0 ? multiply(toPlayer, 1 / enemyDistance) : { x: 0, y: 0 };
    const wobbleAngle = Math.atan2(direction.y, direction.x) + Math.PI / 2;
    const wobbleStrength = enemy.kind === "skitter" ? 18 : 8;
    let speed = enemy.speed * (slowed ? slowMultiplier : 1);

    enemy.contactTimer = Math.max(0, enemy.contactTimer - deltaSeconds);
    enemy.stunTimer = Math.max(0, enemy.stunTimer - deltaSeconds);
    enemy.chargeTimer -= deltaSeconds;

    if (enemy.variant === "charger" && enemy.chargeTimer <= 0) {
      speed *= 2.35;

      if (enemy.chargeTimer <= -0.34) {
        enemy.chargeTimer = 1.75 + Math.random() * 1.2;
      }
    }

    if (enemy.stunTimer > 0) {
      speed *= 0.12;
    }

    enemy.velocity = add(
      multiply(direction, speed),
      {
        x: Math.cos(wobbleAngle + enemy.wobble) * wobbleStrength,
        y: Math.sin(wobbleAngle + enemy.wobble) * wobbleStrength,
      },
    );
    enemy.wobble += deltaSeconds * (enemy.variant === "charger" ? 5 : 3);
    enemy.pos = add(enemy.pos, multiply(enemy.velocity, deltaSeconds));

    if (
      enemyDistance <= enemy.radius + player.radius &&
      enemy.contactTimer <= 0 &&
      player.hurtTimer <= 0
    ) {
      damagePlayer(state, enemy);
      enemy.contactTimer = 0.65;
    }
  });
}

function updateProjectiles(state: RunState, deltaSeconds: number) {
  const remainingProjectiles: Projectile[] = [];

  state.projectiles.forEach((projectile) => {
    projectile.ttl -= deltaSeconds;
    projectile.pos = add(projectile.pos, multiply(projectile.velocity, deltaSeconds));

    if (projectile.ttl <= 0 || isFarOutside(projectile.pos)) {
      return;
    }

    const enemies = [...state.enemies];
    const bosses = [...state.bosses];
    let spent = false;

    for (const enemy of enemies) {
      if (
        projectile.hitIds.includes(enemy.id) ||
        distance(projectile.pos, enemy.pos) > projectile.radius + enemy.radius
      ) {
        continue;
      }

      projectile.hitIds.push(enemy.id);
      damageEnemy(state, enemy, projectile.damage, projectile.color);

      if (projectile.hitIds.length > projectile.pierce) {
        spent = true;
        break;
      }
    }

    if (!spent) {
      for (const boss of bosses) {
        if (
          projectile.hitIds.includes(boss.id) ||
          distance(projectile.pos, boss.pos) > projectile.radius + boss.radius
        ) {
          continue;
        }

        projectile.hitIds.push(boss.id);
        damageBoss(state, boss, projectile.damage * 0.72, projectile.color);

        if (projectile.hitIds.length > projectile.pierce) {
          break;
        }
      }
    }

    if (projectile.hitIds.length <= projectile.pierce) {
      remainingProjectiles.push(projectile);
    }
  });

  state.projectiles = remainingProjectiles;
}

function updateExperienceOrbs(state: RunState, deltaSeconds: number) {
  const player = state.player;
  const remainingOrbs: XpOrb[] = [];
  const heatMagnetBonus = Math.min(72, state.heat * 0.72);

  state.xpOrbs.forEach((orb) => {
    const toPlayer = subtract(player.pos, orb.pos);
    const orbDistance = length(toPlayer);

    if (orbDistance < player.magnetRadius + heatMagnetBonus) {
      orb.velocity = multiply(normalize(toPlayer), XP_PULL_SPEED + state.heat * 1.4);
      addParticle(state, {
        color: "#67e8f9",
        kind: "xpTrail",
        pos: { ...orb.pos },
        radius: 1.6,
        ttl: 0.18,
        velocity: multiply(normalize(toPlayer), 22),
      });
    }

    orb.pos = add(orb.pos, multiply(orb.velocity, deltaSeconds));
    orb.velocity = multiply(orb.velocity, 0.94);

    if (distance(orb.pos, player.pos) <= player.radius + orb.radius + 5) {
      state.xp += orb.value;
      addParticle(state, {
        color: "#67e8f9",
        kind: "spark",
        pos: { ...player.pos },
        radius: 3,
        ttl: 0.32,
        velocity: randomVelocity(70, 140),
      });
      return;
    }

    remainingOrbs.push(orb);
  });

  state.xpOrbs = remainingOrbs;
}

function checkLevelUp(state: RunState) {
  if (state.phase !== "playing" || state.xp < state.xpToNext) {
    return;
  }

  state.xp -= state.xpToNext;
  state.level += 1;
  state.xpToNext = getXpRequirement(state.level);
  state.levelUpOptions = createUpgradeOptions(state);

  if (state.levelUpOptions.length === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    state.player.shield = state.player.maxShield;
    return;
  }

  state.phase = "levelUp";
}

function createUpgradeOptions(state: RunState): UpgradeChoice[] {
  const evolutionChoices = EVOLUTION_IDS.filter((evolutionId) =>
    canChooseEvolution(state, evolutionId),
  ).map((evolutionId) => ({
    evolutionId,
    id: `evolution-${evolutionId}`,
    kind: "evolution" as const,
  }));
  const upgradeChoices = UPGRADE_IDS.filter(
    (upgradeId) => state.upgradeRanks[upgradeId] < UPGRADE_DEFINITIONS[upgradeId].maxRank,
  )
    .sort((left, right) => {
      const rankGap = state.upgradeRanks[left] - state.upgradeRanks[right];
      return rankGap || Math.random() - 0.5;
    })
    .map((upgradeId) => ({
      id: `upgrade-${upgradeId}`,
      kind: "upgrade" as const,
      upgradeId,
    }));

  return [...evolutionChoices, ...upgradeChoices].slice(0, 3);
}

function canChooseEvolution(state: RunState, evolutionId: EvolutionId): boolean {
  if (state.evolvedUpgrades[evolutionId]) {
    return false;
  }

  const evolution = EVOLUTION_DEFINITIONS[evolutionId];

  return (
    state.upgradeRanks[evolution.primary] >= UPGRADE_DEFINITIONS[evolution.primary].maxRank &&
    state.upgradeRanks[evolution.secondary] >= 2
  );
}

function applyEvolution(state: RunState, evolutionId: EvolutionId) {
  state.evolvedUpgrades[evolutionId] = true;

  if (evolutionId === "sanctuaryNova") {
    state.player.maxShield += 26;
    state.player.shield = state.player.maxShield;
  } else if (evolutionId === "prismaticBeam") {
    state.player.phaseBeamTimer = 0;
  } else {
    state.player.bladeTimer = 0;
  }

  addParticle(state, {
    color: "#fef08a",
    kind: "nova",
    pos: { ...state.player.pos },
    radius: 180,
    ttl: 0.7,
    velocity: { x: 0, y: 0 },
    width: 10,
  });
}

function applyUpgrade(player: PlayerState, upgradeId: UpgradeId, rank: number) {
  if (upgradeId === "psionicBlade") {
    player.bladeRank = rank;
  } else if (upgradeId === "phaseBeam") {
    player.beamRank = rank;
    player.phaseBeamTimer = Math.min(player.phaseBeamTimer, 0.2);
  } else if (upgradeId === "purgeNova") {
    player.novaRank = rank;
    player.novaTimer = Math.min(player.novaTimer, 0.4);
  } else if (upgradeId === "shieldOvercharge") {
    player.overchargeRank = rank;
    player.maxShield += 34;
    player.shield = Math.min(player.maxShield, player.shield + 44);
  } else if (upgradeId === "timeWarp") {
    player.slowRank = rank;
  } else {
    player.riftRank = rank;
    player.projectilePierce = rank;
    player.magnetRadius += 8;
  }
}

function damageHostile(
  state: RunState,
  hostile: HostileTarget,
  damage: number,
  color: string,
): boolean {
  if (hostile.kind === "boss") {
    return damageBoss(state, hostile.boss, damage * 0.74, color);
  }

  return damageEnemy(state, hostile.enemy, damage, color);
}

function damageEnemy(state: RunState, enemy: Enemy, damage: number, color: string): boolean {
  enemy.hp -= damage;
  addParticle(state, {
    color,
    kind: "spark",
    pos: { ...enemy.pos },
    radius: enemy.elite ? 4 : 3,
    ttl: 0.24,
    velocity: randomVelocity(60, 180),
  });

  if (enemy.hp > 0) {
    return false;
  }

  const deathPos = { ...enemy.pos };
  state.enemies = state.enemies.filter((entry) => entry.id !== enemy.id);
  state.kills += 1;

  if (enemy.elite) {
    state.eliteKills += 1;
  }

  registerComboKill(state, enemy.elite);
  dropExperience(state, enemy, deathPos);

  for (let index = 0; index < (enemy.elite ? 15 : 8); index += 1) {
    addParticle(state, {
      color: getEnemyColor(enemy),
      kind: "burst",
      pos: deathPos,
      radius: 4 + Math.random() * (enemy.elite ? 7 : 4),
      ttl: 0.38 + Math.random() * 0.24,
      velocity: randomVelocity(80, enemy.elite ? 280 : 220),
    });
  }

  if (enemy.variant === "splitter") {
    spawnSplitlings(state, enemy, deathPos);
  }

  return true;
}

function damageBoss(state: RunState, boss: Boss, damage: number, color: string): boolean {
  boss.hp -= damage;
  addParticle(state, {
    color,
    kind: "spark",
    pos: {
      x: boss.pos.x + (Math.random() - 0.5) * boss.radius,
      y: boss.pos.y + (Math.random() - 0.5) * boss.radius,
    },
    radius: 4 + Math.random() * 2,
    ttl: 0.26,
    velocity: randomVelocity(70, 190),
  });

  if (boss.hp > 0) {
    return false;
  }

  const deathPos = { ...boss.pos };
  const bossDefinition = BOSS_DEFINITIONS[boss.kind];

  state.bosses = state.bosses.filter((entry) => entry.id !== boss.id);
  state.bossHazards = state.bossHazards.filter((hazard) => hazard.bossId !== boss.id);
  state.defeatedBosses.push(boss.kind);
  state.kills += 1;
  state.eliteKills += 1;
  registerComboKill(state, true);
  state.heat = Math.min(100, state.heat + 28);
  state.player.shield = Math.min(state.player.maxShield, state.player.shield + 42);
  dropBossExperience(state, boss, deathPos);

  for (let index = 0; index < 32; index += 1) {
    addParticle(state, {
      color: bossDefinition.color,
      kind: "burst",
      pos: deathPos,
      radius: 5 + Math.random() * 9,
      ttl: 0.56 + Math.random() * 0.36,
      velocity: randomVelocity(120, 360),
    });
  }

  addParticle(state, {
    color: bossDefinition.color,
    kind: "nova",
    pos: deathPos,
    radius: 260,
    ttl: 0.86,
    velocity: { x: 0, y: 0 },
    width: 12,
  });

  updateBossSchedule(state);
  return true;
}

function registerComboKill(state: RunState, elite: boolean) {
  state.comboKills = state.comboTimer > 0 ? state.comboKills + 1 : 1;
  state.comboTimer = COMBO_WINDOW_SECONDS;
  state.heat = Math.min(100, state.heat + (elite ? 18 : 6));
}

function spawnSplitlings(state: RunState, enemy: Enemy, pos: Vector2) {
  for (let index = 0; index < 2; index += 1) {
    const angle = Math.PI * index + Math.random() * 0.8;
    const child = createEnemy(state, "crawler", "normal");
    child.pos = add(pos, { x: Math.cos(angle) * 24, y: Math.sin(angle) * 24 });
    child.hp = Math.max(10, Math.round(enemy.maxHp * 0.22));
    child.maxHp = child.hp;
    child.radius = 11;
    child.speed *= 1.12;
    child.xpValue = 2;
    state.enemies.push(child);
  }
}

function damagePlayer(state: RunState, enemy: Enemy) {
  const player = state.player;
  const damage = enemy.variant === "shieldBreaker" && player.shield > 0
    ? enemy.damage * 1.55
    : enemy.damage;

  damagePlayerFromAmount(state, damage);
}

function damagePlayerFromAmount(
  state: RunState,
  damage: number,
  bypassShieldRatio = 0,
) {
  const player = state.player;
  const directDamage = damage * bypassShieldRatio;
  const blockableDamage = damage - directDamage;
  const shieldDamage = Math.min(player.shield, blockableDamage);
  const hpDamage = blockableDamage - shieldDamage + directDamage;

  player.shield -= shieldDamage;
  player.hp = Math.max(0, player.hp - hpDamage);
  player.hurtTimer = 0.18;
  player.shieldDelay = 0;
  state.heat = Math.max(0, state.heat - 10);

  for (let index = 0; index < 12; index += 1) {
    addParticle(state, {
      color: shieldDamage > 0 ? "#67e8f9" : "#f87171",
      kind: "spark",
      pos: { ...player.pos },
      radius: 3,
      ttl: 0.36,
      velocity: randomVelocity(110, 240),
    });
  }

  if (player.hp <= 0) {
    state.phase = "gameover";
    state.gameOverReason = "생체 군단의 포위망에 보호막이 붕괴되었습니다.";
  }
}

function dropExperience(state: RunState, enemy: Enemy, pos: Vector2) {
  const heatBonus = Math.floor(enemy.xpValue * Math.min(0.7, state.heat / 140));

  state.xpOrbs.push({
    id: nextId(state, "xp"),
    pos,
    radius: enemy.elite ? 9 : enemy.kind === "brute" ? 7 : 5,
    value: enemy.xpValue + heatBonus,
    velocity: randomVelocity(20, enemy.elite ? 120 : 80),
  });
}

function dropBossExperience(state: RunState, boss: Boss, pos: Vector2) {
  const shards = boss.kind === "abyssMatron" ? 12 : boss.kind === "spineWeaver" ? 10 : 8;
  const shardValue = Math.max(12, Math.round(boss.xpValue / shards));

  for (let index = 0; index < shards; index += 1) {
    const angle = (Math.PI * 2 * index) / shards;
    state.xpOrbs.push({
      id: nextId(state, "boss-xp"),
      pos: {
        x: pos.x + Math.cos(angle) * boss.radius * 0.6,
        y: pos.y + Math.sin(angle) * boss.radius * 0.6,
      },
      radius: 10,
      value: shardValue,
      velocity: {
        x: Math.cos(angle) * (90 + Math.random() * 90),
        y: Math.sin(angle) * (90 + Math.random() * 90),
      },
    });
  }
}

function updateParticles(state: RunState, deltaSeconds: number) {
  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      life: particle.life + deltaSeconds,
      pos: add(particle.pos, multiply(particle.velocity, deltaSeconds)),
      ttl: particle.ttl - deltaSeconds,
    }))
    .filter((particle) => particle.ttl > 0)
    .slice(-MAX_PARTICLES);
}

function addParticle(
  state: RunState,
  particle: Omit<Particle, "id" | "life">,
) {
  state.particles.push({
    ...particle,
    id: nextId(state, "particle"),
    life: 0,
  });
}

function addBeam(state: RunState, start: Vector2, end: Vector2, color: string, width: number) {
  addParticle(state, {
    color,
    end: { ...end },
    kind: "beam",
    pos: { ...start },
    radius: 0,
    ttl: 0.18,
    velocity: { x: 0, y: 0 },
    width,
  });
}

function findNearestHostile(
  state: RunState,
  origin: Vector2,
  maxDistance: number,
  excludedIds: string[],
): HostileTarget | null {
  let nearest: HostileTarget | null = null;
  let nearestDistance = maxDistance;

  state.enemies.forEach((enemy) => {
    if (excludedIds.includes(enemy.id)) {
      return;
    }

    const enemyDistance = distance(enemy.pos, origin);

    if (enemyDistance < nearestDistance) {
      nearest = {
        enemy,
        id: enemy.id,
        kind: "enemy",
        pos: enemy.pos,
        radius: enemy.radius,
      };
      nearestDistance = enemyDistance;
    }
  });
  state.bosses.forEach((boss) => {
    if (excludedIds.includes(boss.id)) {
      return;
    }

    const bossDistance = distance(boss.pos, origin);

    if (bossDistance < nearestDistance) {
      nearest = {
        boss,
        id: boss.id,
        kind: "boss",
        pos: boss.pos,
        radius: boss.radius,
      };
      nearestDistance = bossDistance;
    }
  });

  return nearest;
}

function getDifficulty(elapsedSeconds: number, bossActive = false) {
  const finalSurge = elapsedSeconds >= FINAL_SURGE_SECONDS;
  const bossPressureEasing = bossActive ? 0.82 : 1;

  return {
    batchSize: Math.max(
      1,
      Math.round((1 + Math.floor(elapsedSeconds / 40) + (finalSurge ? 1 : 0)) * bossPressureEasing),
    ),
    damageBonus: Math.floor(elapsedSeconds / 55) + (finalSurge ? 2 : 0),
    maxEnemies: Math.min(
      bossActive ? 150 : finalSurge ? 240 : 195,
      Math.round((34 + Math.floor(elapsedSeconds * 0.7)) * (bossActive ? 0.78 : 1)),
    ),
    spawnInterval: Math.max(finalSurge ? 0.22 : 0.34, 1.24 - elapsedSeconds * 0.0049) +
      (bossActive ? 0.18 : 0),
  };
}

function getThreatLevel(state: RunState): number {
  const finalSurgePressure = state.elapsedSeconds >= FINAL_SURGE_SECONDS ? 18 : 0;

  return Math.round(
    Math.min(
      100,
        state.elapsedSeconds * 0.34 +
        state.enemies.length * 0.38 +
        state.bosses.length * 12 +
        state.bossHazards.length * 1.8 +
        state.level * 1.55 +
        finalSurgePressure,
    ),
  );
}

function pickEnemyKind(elapsedSeconds: number): EnemyKind {
  const roll = Math.random();
  const bruteChance = elapsedSeconds < 42 ? 0 : Math.min(0.22, 0.05 + elapsedSeconds / 850);
  const skitterChance = elapsedSeconds < 18 ? 0.12 : Math.min(0.38, 0.18 + elapsedSeconds / 680);

  if (roll < bruteChance) return "brute";
  if (roll < bruteChance + skitterChance) return "skitter";
  return "crawler";
}

function pickEnemyVariant(elapsedSeconds: number): EnemyVariant {
  if (elapsedSeconds < 45) {
    return "normal";
  }

  const eliteChance = Math.min(0.14, 0.03 + elapsedSeconds / 1600);

  if (Math.random() > eliteChance) {
    return "normal";
  }

  const roll = Math.random();

  if (roll < 0.34) return "shieldBreaker";
  if (roll < 0.67) return "charger";
  return "splitter";
}

function getEnemyBase(kind: EnemyKind) {
  if (kind === "skitter") {
    return { damage: 7, hp: 15, radius: 12, speed: 142, xpValue: 7 };
  }

  if (kind === "brute") {
    return { damage: 18, hp: 72, radius: 25, speed: 58, xpValue: 18 };
  }

  return { damage: 9, hp: 22, radius: 15, speed: 86, xpValue: 5 };
}

function getVariantStats(variant: EnemyVariant) {
  if (variant === "shieldBreaker") {
    return { damageScale: 1.16, hpScale: 1.9, radiusScale: 1.12, speedScale: 0.96, xpScale: 3.2 };
  }

  if (variant === "charger") {
    return { damageScale: 1.08, hpScale: 1.55, radiusScale: 1.05, speedScale: 1.08, xpScale: 2.6 };
  }

  if (variant === "splitter") {
    return { damageScale: 1.02, hpScale: 1.72, radiusScale: 1.08, speedScale: 0.98, xpScale: 2.8 };
  }

  return { damageScale: 1, hpScale: 1, radiusScale: 1, speedScale: 1, xpScale: 1 };
}

function getEnemyColor(enemy: Enemy): string {
  if (enemy.variant === "shieldBreaker") return "#f97316";
  if (enemy.variant === "charger") return "#fb7185";
  if (enemy.variant === "splitter") return "#c084fc";
  return enemy.kind === "brute" ? "#c084fc" : "#fb7185";
}

function findPrimaryEvolution(upgradeId: UpgradeId): UpgradeEvolution | null {
  return EVOLUTION_IDS.map((id) => EVOLUTION_DEFINITIONS[id]).find(
    (evolution) => evolution.primary === upgradeId,
  ) ?? null;
}

function randomEdgePosition(): Vector2 {
  const margin = 76;
  const side = Math.floor(Math.random() * 4);

  if (side === 0) return { x: Math.random() * VIEWPORT_WIDTH, y: -margin };
  if (side === 1) return { x: VIEWPORT_WIDTH + margin, y: Math.random() * VIEWPORT_HEIGHT };
  if (side === 2) return { x: Math.random() * VIEWPORT_WIDTH, y: VIEWPORT_HEIGHT + margin };
  return { x: -margin, y: Math.random() * VIEWPORT_HEIGHT };
}

function getXpRequirement(level: number) {
  return 18 + level * 9 + Math.floor(Math.pow(level, 1.35) * 5);
}

function nextId(state: RunState, prefix: string) {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return id;
}

function isFarOutside(pos: Vector2) {
  return (
    pos.x < -140 ||
    pos.y < -140 ||
    pos.x > VIEWPORT_WIDTH + 140 ||
    pos.y > VIEWPORT_HEIGHT + 140
  );
}

function clampToArena(pos: Vector2, radius: number): Vector2 {
  return {
    x: Math.min(VIEWPORT_WIDTH - radius, Math.max(radius, pos.x)),
    y: Math.min(VIEWPORT_HEIGHT - radius, Math.max(radius, pos.y)),
  };
}

function randomVelocity(minSpeed: number, maxSpeed: number): Vector2 {
  const angle = Math.random() * Math.PI * 2;
  const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function multiply(vector: Vector2, scalar: number): Vector2 {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

function normalize(vector: Vector2): Vector2 {
  const vectorLength = length(vector);
  return vectorLength === 0 ? { x: 0, y: 0 } : multiply(vector, 1 / vectorLength);
}

function length(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDifference(left: number, right: number): number {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
