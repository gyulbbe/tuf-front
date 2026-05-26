import {
  ROOM_HEIGHT,
  ROOM_WIDTH,
  canUseExit,
  clampToRoom,
  createDungeon,
  getDoorCenter,
  getEntrancePosition,
  getExit,
  getRoom,
} from "./dungeon";
import { createRng } from "./rng";
import type {
  ArtifactId,
  ArtifactRanks,
  AttackZone,
  BossKind,
  BossPatternId,
  DirectionName,
  DungeonDefinition,
  EnemyKind,
  EnemyState,
  EvolutionStage,
  FloatingText,
  InputState,
  Obstacle,
  Pickup,
  PickupType,
  PlayerState,
  Projectile,
  RoomDefinition,
  RoomSnapshot,
  RunPhase,
  RunSnapshot,
  RunState,
  Vector,
} from "./types";

export const VIEWPORT_WIDTH = ROOM_WIDTH;
export const VIEWPORT_HEIGHT = ROOM_HEIGHT;

const MAX_LOGS = 9;
const PLAYER_RADIUS = 16;
const SHIELD_REGEN_DELAY = 2.8;
const SHIELD_REGEN_PER_SECOND = 7.5;
const BASE_PLAYER_HP = 68;
const BASE_PLAYER_SHIELD = 26;
const PLAYER_PROJECTILE_SPEED = 640;
const WALL_COLOR = "#39291e";
const FLOOR_COLOR = "#17171d";

export const ARTIFACT_LABELS: Record<ArtifactId, string> = {
  battleForesight: "전투 예지",
  bladeAmplifier: "광검 증폭",
  dashShockwave: "돌진 충격파",
  desperationCircuit: "절박 회로",
  energyAbsorption: "에너지 흡수",
  focusedWave: "집중 파동",
  killBurst: "처치 폭발",
  phaseAcceleration: "차원 가속",
  piercingLance: "관통 광창",
  shieldRebuke: "보호막 반격",
  shieldResonance: "보호막 공명",
  splitPrism: "분열 프리즘",
};

export const ARTIFACT_DESCRIPTIONS: Record<ArtifactId, string> = {
  battleForesight: "피격 후 다음 광탄 피해가 크게 증가합니다.",
  bladeAmplifier: "기본 공격력이 증가합니다.",
  dashShockwave: "회피 돌진을 시작할 때 주변 적에게 충격 피해를 줍니다.",
  desperationCircuit: "HP가 낮을수록 공격 간격이 짧아집니다.",
  energyAbsorption: "적을 처치할 때 Shield를 회복합니다.",
  focusedWave: "회피 돌진 충돌 피해가 증가합니다.",
  killBurst: "적 처치 시 작은 폭발로 주변 적에게 피해를 줍니다.",
  phaseAcceleration: "회피 돌진 쿨다운이 감소합니다.",
  piercingLance: "광탄이 적을 추가로 관통합니다.",
  shieldRebuke: "Shield로 피해를 막으면 주변에 반격 파동을 냅니다.",
  shieldResonance: "최대 Shield와 현재 Shield가 증가합니다.",
  splitPrism: "광탄이 좌우 보조 광탄을 함께 발사합니다.",
};

export const ENEMY_LABELS: Record<EnemyKind, string> = {
  afterimageShard: "잔광 파편체",
  boss: "보스",
  gravityNode: "중력 결절",
  guardian: "방패 수호자",
  regenerationPriest: "재생 사제",
  resonanceTurret: "공명 포탑",
  riftApostle: "균열 사도",
  riftMine: "균열 지뢰체",
  stalker: "추적 괴수",
  warpLeaper: "왜곡 도약자",
};

export const BOSS_LABELS: Record<BossKind, string> = {
  armoredJudicator: "장갑 심판체",
  deepTuner: "심층 조율기",
  echoSplinterCore: "잔향 분열핵",
  gravityObserver: "중력 관측체",
  resonanceHierophant: "공명 대사제",
  riftGatekeeper: "균열 문지기",
  waveCrusher: "파동 분쇄기",
};

const BOSS_PATTERN_LABELS: Record<BossPatternId, string> = {
  bossLunge: "연속 돌진",
  delayedRift: "지연 균열",
  fanVolley: "부채꼴 탄막",
  gravityPulse: "중력 파동",
  laserSweep: "조준 광선",
  mirrorClone: "거울 분신",
  ringBurst: "원형 탄막",
  shockwaveLine: "직선 충격파",
  summonGuard: "수호 소환",
};

export const EVOLUTION_LABELS: Record<EvolutionStage, string> = {
  dualBladeAssault: "쌍검 돌격형",
  lightbladeTrainee: "광검 수련자",
};

export const PICKUP_LABELS: Record<PickupType, string> = {
  artifactCache: "유물 상자",
  bladeResonance: "광검 공명석",
  healingCrystal: "회복 수정",
  shieldCrystal: "보호막 결정",
};

const ARTIFACT_IDS: ArtifactId[] = [
  "bladeAmplifier",
  "shieldResonance",
  "battleForesight",
  "phaseAcceleration",
  "energyAbsorption",
  "focusedWave",
  "piercingLance",
  "splitPrism",
  "dashShockwave",
  "shieldRebuke",
  "killBurst",
  "desperationCircuit",
];

export function createEmptyInput(): InputState {
  return {
    dashQueued: false,
    down: false,
    fireDown: false,
    fireLeft: false,
    fireRight: false,
    fireUp: false,
    hasPointer: false,
    left: false,
    pointerDown: false,
    pointerX: VIEWPORT_WIDTH / 2,
    pointerY: VIEWPORT_HEIGHT / 2,
    right: false,
    up: false,
  };
}

export function createRunState(
  rawSeed: string,
  phase: RunPhase = "playing",
): RunState {
  const seed = rawSeed.trim() || "psionic-run";
  const floor = 1;
  const dungeon = createDungeon(seed, floor);
  const player = createPlayer();

  const run: RunState = {
    attackZones: [],
    clearedRoomIds: [],
    currentRoomId: dungeon.startRoomId,
    discoveredRoomIds: [dungeon.startRoomId],
    dungeon,
    elapsed: 0,
    enemies: [],
    floatingTexts: [],
    floor,
    killCount: 0,
    lastShieldLogAt: -99,
    logs: phase === "title" ? ["Seed를 정하고 새 게임을 시작하세요."] : [],
    nextId: 1,
    pendingRelicChoice: null,
    phase,
    piercedEnemyIds: [],
    pickups: [],
    player,
    projectiles: [],
    roomRewardClaimedIds: [],
    seed,
  };

  enterRoom(run, dungeon.startRoomId, null);

  if (phase !== "title") {
    addLogs(run, [
      `"${seed}" seed로 균열 지도가 열렸습니다.`,
      "광탄과 회피 돌진으로 방을 돌파하세요.",
      describeDifficulty(dungeon),
    ]);
  }

  return run;
}

export function createNextFloorRun(previous: RunState): RunState {
  const nextFloor = previous.floor + 1;
  const dungeon = createDungeon(previous.seed, nextFloor);
  const player: PlayerState = {
    ...previous.player,
    dashCooldownRemaining: 0,
    dashUntil: 0,
    fireCooldownRemaining: 0,
    hp: Math.min(previous.player.maxHp, previous.player.hp + 10),
    invulnerableUntil: 0,
    lastDamageAt: -99,
    shield: Math.min(previous.player.maxShield, previous.player.shield + 12),
    x: VIEWPORT_WIDTH / 2,
    y: VIEWPORT_HEIGHT / 2,
  };

  const run: RunState = {
    attackZones: [],
    clearedRoomIds: [],
    currentRoomId: dungeon.startRoomId,
    discoveredRoomIds: [dungeon.startRoomId],
    dungeon,
    elapsed: previous.elapsed,
    enemies: [],
    floatingTexts: [],
    floor: nextFloor,
    killCount: previous.killCount,
    lastShieldLogAt: previous.elapsed,
    logs: previous.logs,
    nextId: previous.nextId + 1,
    pendingRelicChoice: null,
    phase: "playing",
    piercedEnemyIds: [],
    pickups: [],
    player,
    projectiles: [],
    roomRewardClaimedIds: [],
    seed: previous.seed,
  };

  enterRoom(run, dungeon.startRoomId, null);
  addLogs(run, [`${nextFloor}층으로 내려왔습니다.`, describeDifficulty(dungeon)]);

  return run;
}

export function createSnapshot(run: RunState): RunSnapshot {
  const currentRoom = getRoom(run.dungeon, run.currentRoomId);
  const boss = run.enemies.find((enemy) => enemy.boss);

  return {
    attack: run.player.attack,
    artifactRanks: { ...run.player.artifacts },
    bossHp: boss ? Math.max(0, Math.ceil(boss.hp)) : null,
    bossKind: boss?.boss?.kind ?? null,
    bossMaxHp: boss ? boss.maxHp : null,
    bossPatternLabel: boss?.boss?.currentPattern?.label ?? null,
    bossPhase: boss?.boss?.phase ?? null,
    currentRoomKind: currentRoom.kind,
    currentRoomModifier: currentRoom.modifier,
    dashCooldown: run.player.dashCooldown,
    dashCooldownRemaining: Math.max(0, run.player.dashCooldownRemaining),
    enemiesRemaining: run.enemies.length,
    evolution: run.player.evolution,
    floor: run.floor,
    hp: Math.ceil(run.player.hp),
    killCount: run.killCount,
    logs: [...run.logs],
    maxHp: run.player.maxHp,
    maxShield: run.player.maxShield,
    pendingRelicChoice: run.pendingRelicChoice,
    phase: run.phase,
    rooms: createRoomSnapshots(run),
    seed: run.seed,
    shield: Math.ceil(run.player.shield),
  };
}

export function updateRun(run: RunState, input: InputState, rawDeltaSeconds: number, now: number) {
  run.elapsed = now;

  if (run.phase !== "playing") {
    input.dashQueued = false;
    updateFloatingTexts(run, rawDeltaSeconds);
    return;
  }

  const deltaSeconds = Math.min(Math.max(rawDeltaSeconds, 0), 0.04);

  updatePlayer(run, input, deltaSeconds, now);
  updateProjectiles(run, deltaSeconds, now);
  updateEnemies(run, deltaSeconds, now);
  updateRoomModifier(run, deltaSeconds, now);
  updateAttackZones(run, deltaSeconds, now);
  collectPickups(run);
  checkRoomCompletion(run);
  checkPortal(run);
  regenerateShield(run, deltaSeconds, now);
  updateFloatingTexts(run, deltaSeconds);
}

export function chooseRelic(run: RunState, artifactId: ArtifactId) {
  if (
    run.phase !== "choosingRelic" ||
    !run.pendingRelicChoice?.options.includes(artifactId)
  ) {
    return;
  }

  applyArtifact(run, artifactId);
  run.pendingRelicChoice = null;
  run.phase = "playing";
}

export function renderGame(context: CanvasRenderingContext2D, run: RunState) {
  const room = getRoom(run.dungeon, run.currentRoomId);
  const now = run.elapsed;

  context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  drawRoom(context, room, run);
  drawAttackZones(context, run.attackZones, now);
  drawPickups(context, run.pickups, now);
  drawProjectiles(context, run.projectiles);
  drawEnemies(context, run.enemies, now);
  drawPlayer(context, run.player, now);
  drawFloatingTexts(context, run.floatingTexts);
  drawVignette(context);
}

function createPlayer(): PlayerState {
  return {
    artifacts: createArtifactRanks(),
    attack: 9,
    bladeResonance: 0,
    dashCooldown: 2.7,
    dashCooldownRemaining: 0,
    dashDamage: 12,
    dashUntil: 0,
    dashVx: 0,
    dashVy: 0,
    evolution: "lightbladeTrainee",
    fireCooldown: 0.22,
    fireCooldownRemaining: 0,
    hp: BASE_PLAYER_HP,
    invulnerableUntil: 0,
    killShieldRestore: 0,
    killExplosionDamage: 0,
    lastDamageAt: -99,
    maxHp: BASE_PLAYER_HP,
    maxShield: BASE_PLAYER_SHIELD,
    nextShotBonus: 0,
    piercingShots: 0,
    radius: PLAYER_RADIUS,
    shield: BASE_PLAYER_SHIELD,
    shieldRetaliationDamage: 0,
    splitShotCount: 0,
    speed: 238,
    x: VIEWPORT_WIDTH / 2,
    y: VIEWPORT_HEIGHT / 2,
  };
}

function createArtifactRanks(): ArtifactRanks {
  return {
    battleForesight: 0,
    bladeAmplifier: 0,
    dashShockwave: 0,
    desperationCircuit: 0,
    energyAbsorption: 0,
    focusedWave: 0,
    killBurst: 0,
    phaseAcceleration: 0,
    piercingLance: 0,
    shieldRebuke: 0,
    shieldResonance: 0,
    splitPrism: 0,
  };
}

function updatePlayer(
  run: RunState,
  input: InputState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const room = getRoom(run.dungeon, run.currentRoomId);
  const speed = getPlayerSpeedForRoom(player, room);

  player.dashCooldownRemaining = Math.max(0, player.dashCooldownRemaining - deltaSeconds);
  player.fireCooldownRemaining = Math.max(0, player.fireCooldownRemaining - deltaSeconds);

  if (input.dashQueued) {
    tryStartDash(run, input, now);
    input.dashQueued = false;
  }

  const dashActive = now < player.dashUntil;
  const moveVector = dashActive
    ? { x: player.dashVx, y: player.dashVy }
    : getMoveVector(input, speed);

  moveEntity(room, player, moveVector.x * deltaSeconds, moveVector.y * deltaSeconds);
  tryRoomTransition(run, input);

  if (player.fireCooldownRemaining <= 0) {
    const aim = getAimVector(input, player);

    if (aim) {
      firePlayerProjectile(run, aim);
    }
  }

  if (dashActive) {
    damageDashOverlaps(run, now);
  }
}

function tryStartDash(run: RunState, input: InputState, now: number) {
  const player = run.player;

  if (player.dashCooldownRemaining > 0) {
    addLogs(run, [`회피 돌진 대기 중: ${player.dashCooldownRemaining.toFixed(1)}초`]);
    return;
  }

  const direction = normalize(getMoveVector(input, 1));
  const fallbackAim = getAimVector(input, player);
  const dashDirection = length(direction) > 0 ? direction : fallbackAim;

  if (!dashDirection || length(dashDirection) === 0) {
    addLogs(run, ["회피 돌진 실패: 방향 입력이 없습니다."]);
    return;
  }

  player.dashCooldownRemaining = player.dashCooldown;
  player.dashUntil = now + 0.18;
  player.invulnerableUntil = now + 0.24;
  player.dashVx = dashDirection.x * 760;
  player.dashVy = dashDirection.y * 760;
  addLogs(run, ["회피 돌진 사용."]);

  if (player.artifacts.dashShockwave > 0) {
    const damage = Math.round(player.dashDamage * (0.55 + player.artifacts.dashShockwave * 0.15));
    damageEnemiesAround(run, player.x, player.y, 88, damage);
    addFloatingText(run, "shock", player.x, player.y - 32, "#8fd3ff");
  }
}

function getMoveVector(input: InputState, speed: number): Vector {
  const vector = {
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  };
  const normalized = normalize(vector);

  return {
    x: normalized.x * speed,
    y: normalized.y * speed,
  };
}

function getAimVector(input: InputState, player: PlayerState): Vector | null {
  const keyboardAim = normalize({
    x: Number(input.fireRight) - Number(input.fireLeft),
    y: Number(input.fireDown) - Number(input.fireUp),
  });

  if (length(keyboardAim) > 0) {
    return keyboardAim;
  }

  if (!input.pointerDown || !input.hasPointer) {
    return null;
  }

  const pointerAim = normalize({
    x: input.pointerX - player.x,
    y: input.pointerY - player.y,
  });

  return length(pointerAim) > 0 ? pointerAim : null;
}

function firePlayerProjectile(run: RunState, direction: Vector) {
  const player = run.player;
  const damage = player.attack + player.nextShotBonus;
  const spreadAngles = player.splitShotCount > 0 ? [-0.2, 0, 0.2] : [0];

  spreadAngles.forEach((angle) => {
    const shotDirection = angle === 0 ? direction : rotateVector(direction, angle);
    const projectile = createProjectile({
      color: player.nextShotBonus > 0 ? "#fde68a" : "#8fd3ff",
      damage: angle === 0 ? damage : Math.max(1, Math.round(damage * 0.55)),
      owner: "player",
      pierceRemaining: player.piercingShots,
      radius: angle === 0 ? 5.5 : 4.5,
      speed: PLAYER_PROJECTILE_SPEED,
      ttl: player.piercingShots > 0 ? 1.55 : 1.35,
      vector: shotDirection,
      x: player.x + shotDirection.x * (player.radius + 8),
      y: player.y + shotDirection.y * (player.radius + 8),
    }, run);

    run.projectiles.push(projectile);
  });

  player.fireCooldownRemaining = getEffectiveFireCooldown(player);
  player.nextShotBonus = 0;
}

function updateProjectiles(run: RunState, deltaSeconds: number, now: number) {
  const room = getRoom(run.dungeon, run.currentRoomId);
  const projectiles: Projectile[] = [];

  for (const projectile of run.projectiles) {
    projectile.ttl -= deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;

    if (
      projectile.ttl <= 0 ||
      projectileHitsWallOrObstacle(projectile, room.obstacles)
    ) {
      continue;
    }

    if (projectile.owner === "player") {
      const enemy = run.enemies.find((entry) =>
        !projectile.hitEnemyIds.includes(entry.id) && circlesOverlap(projectile, entry),
      );

      if (enemy) {
        damageEnemy(run, enemy, projectile.damage);
        projectile.hitEnemyIds.push(enemy.id);

        if (projectile.pierceRemaining <= 0) {
          continue;
        }

        projectile.pierceRemaining -= 1;
      }
    } else if (circlesOverlap(projectile, run.player)) {
      damagePlayer(run, projectile.damage, now, "투사체 피격");
      continue;
    }

    projectiles.push(projectile);
  }

  run.projectiles = projectiles;
}

function updateEnemies(run: RunState, deltaSeconds: number, now: number) {
  const room = getRoom(run.dungeon, run.currentRoomId);

  for (const enemy of run.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - deltaSeconds);

    switch (enemy.kind) {
      case "afterimageShard":
        updateAfterimageShard(run, room, enemy, deltaSeconds, now);
        break;
      case "boss":
        updateBoss(run, room, enemy, deltaSeconds, now);
        break;
      case "gravityNode":
        updateGravityNode(run, room, enemy, deltaSeconds);
        break;
      case "guardian":
        updateGuardian(run, room, enemy, deltaSeconds, now);
        break;
      case "regenerationPriest":
        updateRegenerationPriest(run, room, enemy, deltaSeconds);
        break;
      case "resonanceTurret":
        updateResonanceTurret(run, enemy, now);
        break;
      case "riftApostle":
        updateRiftApostle(run, room, enemy, deltaSeconds, now);
        break;
      case "riftMine":
        updateRiftMine(run, room, enemy, deltaSeconds, now);
        break;
      case "warpLeaper":
        updateWarpLeaper(run, room, enemy, deltaSeconds, now);
        break;
      case "stalker":
        updateStalker(run, room, enemy, deltaSeconds, now);
        break;
    }
  }
}

function updateStalker(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };
  const distanceToPlayer = length(toPlayer);

  if (enemy.phase === "windup" && now >= enemy.phaseUntil) {
    const lunge = normalize({ x: enemy.targetX - enemy.x, y: enemy.targetY - enemy.y });
    enemy.phase = "lunging";
    enemy.phaseUntil = now + 0.24;
    enemy.vx = lunge.x * 560;
    enemy.vy = lunge.y * 560;
  }

  if (enemy.phase === "lunging") {
    moveEntity(room, enemy, enemy.vx * deltaSeconds, enemy.vy * deltaSeconds);

    if (circlesOverlap(enemy, player)) {
      damagePlayer(run, enemy.attack, now, "추적 괴수 돌진");
      enemy.phaseUntil = Math.min(enemy.phaseUntil, now);
    }

    if (now >= enemy.phaseUntil) {
      enemy.phase = "moving";
      enemy.cooldown = 1.1;
    }
    return;
  }

  if (enemy.phase === "windup") {
    return;
  }

  if (distanceToPlayer < 132 && enemy.cooldown <= 0) {
    enemy.phase = "windup";
    enemy.phaseUntil = now + 0.38;
    enemy.targetX = player.x;
    enemy.targetY = player.y;
    addLogs(run, ["추적 괴수가 몸을 낮추고 돌진을 준비합니다."]);
    return;
  }

  const chase = normalize(toPlayer);
  moveEntity(room, enemy, chase.x * enemy.speed * deltaSeconds, chase.y * enemy.speed * deltaSeconds);
}

function updateAfterimageShard(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = normalize({ x: player.x - enemy.x, y: player.y - enemy.y });
  const weave = {
    x: -toPlayer.y * Math.sin(now * 6 + enemy.x * 0.02),
    y: toPlayer.x * Math.sin(now * 6 + enemy.y * 0.02),
  };
  const direction = normalize({
    x: toPlayer.x + weave.x * 0.55,
    y: toPlayer.y + weave.y * 0.55,
  });

  moveEntity(room, enemy, direction.x * enemy.speed * deltaSeconds, direction.y * enemy.speed * deltaSeconds);

  if (circlesOverlap(enemy, player) && enemy.cooldown <= 0) {
    damagePlayer(run, enemy.attack, now, "잔광 파편체 접촉");
    enemy.cooldown = 0.85;
  }
}

function updateResonanceTurret(run: RunState, enemy: EnemyState, now: number) {
  const player = run.player;

  if (enemy.phase === "casting" && now >= enemy.phaseUntil) {
    const aim = normalize({ x: enemy.targetX - enemy.x, y: enemy.targetY - enemy.y });

    run.projectiles.push(
      createProjectile({
        color: "#f9e2af",
        damage: enemy.attack + 1,
        owner: "enemy",
        radius: 7,
        speed: 500,
        ttl: 2,
        vector: aim,
        x: enemy.x + aim.x * 24,
        y: enemy.y + aim.y * 24,
      }, run),
    );
    enemy.phase = "moving";
    enemy.cooldown = 1.55;
    return;
  }

  if (enemy.phase === "casting") {
    return;
  }

  if (enemy.cooldown <= 0) {
    enemy.phase = "casting";
    enemy.phaseUntil = now + 0.55;
    enemy.targetX = player.x;
    enemy.targetY = player.y;
    enemy.action = "turretShot";
    addLogs(run, ["공명 포탑이 직선 조준선을 고정합니다."]);
  }
}

function updateWarpLeaper(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };
  const distanceToPlayer = length(toPlayer);

  if (enemy.phase === "windup" && now >= enemy.phaseUntil) {
    enemy.x = clampToRoom(enemy.targetX, enemy.radius, "x");
    enemy.y = clampToRoom(enemy.targetY, enemy.radius, "y");
    enemy.phase = "moving";
    enemy.cooldown = 1.7;
    run.attackZones.push({
      activeUntil: now + 0.18,
      damage: enemy.attack + 3,
      hasHitPlayer: false,
      id: createId(run, "warp"),
      kind: "warpSlash",
      radius: 70,
      telegraphUntil: now,
      x: enemy.x,
      y: enemy.y,
    });
    return;
  }

  if (enemy.phase === "windup") {
    return;
  }

  if (distanceToPlayer < 360 && enemy.cooldown <= 0) {
    const approach = normalize({ x: enemy.x - player.x, y: enemy.y - player.y });

    enemy.phase = "windup";
    enemy.phaseUntil = now + 0.62;
    enemy.targetX = player.x + approach.x * 34;
    enemy.targetY = player.y + approach.y * 34;
    enemy.action = "warpSlash";
    run.attackZones.push({
      activeUntil: now + 0.64,
      damage: 0,
      hasHitPlayer: false,
      id: createId(run, "warp-mark"),
      kind: "warpSlash",
      radius: 62,
      telegraphUntil: now + 0.62,
      x: enemy.targetX,
      y: enemy.targetY,
    });
    addLogs(run, ["왜곡 도약자가 착지 지점을 예고합니다."]);
    return;
  }

  const chase = normalize(toPlayer);
  moveEntity(room, enemy, chase.x * enemy.speed * deltaSeconds, chase.y * enemy.speed * deltaSeconds);
}

function updateRegenerationPriest(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
) {
  const wounded = run.enemies
    .filter((entry) => entry.id !== enemy.id && entry.hp < entry.maxHp && distance(entry, enemy) < 250)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

  if (wounded && enemy.cooldown <= 0) {
    const heal = 10 + run.floor * 2;

    wounded.hp = Math.min(wounded.maxHp, wounded.hp + heal);
    enemy.cooldown = 2.4;
    addFloatingText(run, `+${heal}`, wounded.x, wounded.y - 24, "#86efac");
    addLogs(run, ["재생 사제가 주변 괴수를 회복합니다."]);
    return;
  }

  if (!wounded && enemy.cooldown <= 0) {
    const aim = normalize({ x: run.player.x - enemy.x, y: run.player.y - enemy.y });

    run.projectiles.push(
      createProjectile({
        color: "#86efac",
        damage: enemy.attack,
        owner: "enemy",
        radius: 6,
        speed: 310,
        ttl: 2.2,
        vector: aim,
        x: enemy.x + aim.x * 22,
        y: enemy.y + aim.y * 22,
      }, run),
    );
    enemy.cooldown = 1.9;
  }

  const away = normalize({ x: enemy.x - run.player.x, y: enemy.y - run.player.y });
  moveEntity(room, enemy, away.x * enemy.speed * deltaSeconds, away.y * enemy.speed * deltaSeconds);
}

function updateRiftMine(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };

  if (enemy.phase === "windup" && now >= enemy.phaseUntil) {
    run.attackZones.push({
      activeUntil: now + 0.22,
      damage: enemy.attack + 7,
      hasHitPlayer: false,
      id: createId(run, "mine"),
      kind: "mineBlast",
      radius: 88,
      telegraphUntil: now,
      x: enemy.x,
      y: enemy.y,
    });
    run.enemies = run.enemies.filter((entry) => entry.id !== enemy.id);
    addFloatingText(run, "boom", enemy.x, enemy.y - 20, "#fca5a5");
    return;
  }

  if (enemy.phase === "windup") {
    return;
  }

  if (length(toPlayer) < 108) {
    enemy.phase = "windup";
    enemy.phaseUntil = now + 0.78;
    enemy.action = "mineBlast";
    run.attackZones.push({
      activeUntil: now + 0.8,
      damage: 0,
      hasHitPlayer: false,
      id: createId(run, "mine-mark"),
      kind: "mineBlast",
      radius: 86,
      telegraphUntil: now + 0.78,
      x: enemy.x,
      y: enemy.y,
    });
    addLogs(run, ["균열 지뢰체가 폭발 범위를 밝힙니다."]);
    return;
  }

  const chase = normalize(toPlayer);
  moveEntity(room, enemy, chase.x * enemy.speed * deltaSeconds, chase.y * enemy.speed * deltaSeconds);
}

function updateGravityNode(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
) {
  const playerPull = normalize({ x: enemy.x - run.player.x, y: enemy.y - run.player.y });
  const playerDistance = distance(enemy, run.player);

  if (playerDistance < 300) {
    const strength = (1 - playerDistance / 300) * 92;
    moveEntity(room, run.player, playerPull.x * strength * deltaSeconds, playerPull.y * strength * deltaSeconds);
  }

  run.projectiles.forEach((projectile) => {
    const pull = normalize({ x: enemy.x - projectile.x, y: enemy.y - projectile.y });
    const projectileDistance = distance(enemy, projectile);

    if (projectileDistance < 260) {
      projectile.vx += pull.x * 190 * deltaSeconds;
      projectile.vy += pull.y * 190 * deltaSeconds;
    }
  });

  if (enemy.cooldown <= 0) {
    fireRadialProjectiles(run, enemy.x, enemy.y, 6, enemy.attack, "#93c5fd", 260);
    enemy.cooldown = 2.6;
    addLogs(run, ["중력 결절이 탄 궤도를 휘게 합니다."]);
  }
}

function updateGuardian(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };
  const distanceToPlayer = length(toPlayer);

  if (enemy.phase === "windup" && now >= enemy.phaseUntil) {
    enemy.phase = "moving";
    enemy.cooldown = 2.25;
    return;
  }

  if (enemy.phase === "windup") {
    return;
  }

  if (distanceToPlayer < 106 && enemy.cooldown <= 0) {
    const telegraphUntil = now + 0.7;

    enemy.phase = "windup";
    enemy.phaseUntil = telegraphUntil;
    run.attackZones.push({
      activeUntil: telegraphUntil + 0.18,
      damage: enemy.attack + 4,
      hasHitPlayer: false,
      id: createId(run, "slam"),
      kind: "guardianSlam",
      radius: 88,
      telegraphUntil,
      x: enemy.x,
      y: enemy.y,
    });
    addLogs(run, ["방패 수호자가 넓은 강타를 예고합니다."]);
    return;
  }

  const chase = normalize(toPlayer);
  moveEntity(room, enemy, chase.x * enemy.speed * deltaSeconds, chase.y * enemy.speed * deltaSeconds);
}

function updateRiftApostle(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  const player = run.player;
  const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };
  const distanceToPlayer = length(toPlayer);

  if (enemy.phase === "casting" && now >= enemy.phaseUntil) {
    const aim = normalize({ x: enemy.targetX - enemy.x, y: enemy.targetY - enemy.y });

    run.projectiles.push(
      createProjectile({
        color: "#c084fc",
        damage: enemy.attack + 2,
        owner: "enemy",
        radius: 8,
        speed: 360,
        ttl: 2.2,
        vector: aim,
        x: enemy.x + aim.x * 26,
        y: enemy.y + aim.y * 26,
      }, run),
    );
    enemy.phase = "moving";
    enemy.cooldown = 1.75;
    return;
  }

  if (enemy.phase === "casting") {
    return;
  }

  if (enemy.cooldown <= 0 && distanceToPlayer < 620) {
    const telegraphUntil = now + 0.72;

    enemy.phase = "casting";
    enemy.phaseUntil = telegraphUntil;
    enemy.targetX = player.x;
    enemy.targetY = player.y;
    run.attackZones.push({
      activeUntil: telegraphUntil + 0.2,
      damage: enemy.attack + 5,
      hasHitPlayer: false,
      id: createId(run, "rift"),
      kind: "riftBurst",
      radius: 54,
      telegraphUntil,
      x: player.x,
      y: player.y,
    });
    addLogs(run, ["균열 사도가 발밑에 위험 지점을 새깁니다."]);
    return;
  }

  const desiredDistance = distanceToPlayer < 220 ? -1 : 1;
  const direction = normalize(toPlayer);

  moveEntity(
    room,
    enemy,
    direction.x * enemy.speed * desiredDistance * deltaSeconds,
    direction.y * enemy.speed * desiredDistance * deltaSeconds,
  );
}

function updateBoss(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  deltaSeconds: number,
  now: number,
) {
  if (!enemy.boss) {
    return;
  }

  updateBossPhase(run, enemy);

  if (enemy.phase === "windup" && now >= enemy.phaseUntil) {
    executeBossAction(run, room, enemy, now);
    return;
  }

  if (enemy.phase === "windup" || enemy.phase === "lunging") {
    if (enemy.phase === "lunging") {
      moveEntity(room, enemy, enemy.vx * deltaSeconds, enemy.vy * deltaSeconds);

      if (circlesOverlap(enemy, run.player)) {
        damagePlayer(run, enemy.attack + 5, now, `${getBossLabel(enemy)} 돌진`);
      }

      if (now >= enemy.phaseUntil) {
        enemy.phase = "moving";
        if (enemy.boss) {
          enemy.boss.currentPattern = null;
        }
        enemy.cooldown = getBossCooldown(enemy);
      }
    }
    return;
  }

  const toPlayer = { x: run.player.x - enemy.x, y: run.player.y - enemy.y };
  const desiredDistance = enemy.boss.kind === "resonanceHierophant" ? 260 : 180;
  const direction = normalize(toPlayer);
  const moveSign = length(toPlayer) < desiredDistance ? -1 : 1;

  moveEntity(
    room,
    enemy,
    direction.x * enemy.speed * moveSign * deltaSeconds,
    direction.y * enemy.speed * moveSign * deltaSeconds,
  );

  if (enemy.cooldown <= 0) {
    beginBossPattern(run, enemy, now);
  }
}

function updateBossPhase(run: RunState, enemy: EnemyState) {
  if (!enemy.boss) {
    return;
  }

  const ratio = enemy.hp / enemy.maxHp;
  const nextPhase = ratio <= 0.15 ? 4 : ratio <= 0.4 ? 3 : ratio <= 0.7 ? 2 : 1;

  if (nextPhase === enemy.boss.phase) {
    return;
  }

  enemy.boss.phase = nextPhase;
  enemy.cooldown = Math.min(enemy.cooldown, 0.45);
  addLogs(run, `${getBossLabel(enemy)}의 패턴이 거칠어집니다.`);
}

function beginBossPattern(run: RunState, enemy: EnemyState, now: number) {
  if (!enemy.boss) {
    return;
  }

  const pattern = selectBossPattern(enemy, run.floor, now);
  const telegraphDuration = getBossTelegraphDuration(pattern, enemy.boss.phase);
  const executeAt = now + telegraphDuration;
  const angle = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);

  enemy.phase = "windup";
  enemy.action = pattern;
  enemy.phaseUntil = executeAt;
  enemy.targetX = run.player.x;
  enemy.targetY = run.player.y;
  enemy.boss.currentPattern = {
    angle,
    executeAt,
    id: pattern,
    label: BOSS_PATTERN_LABELS[pattern],
    startedAt: now,
    targetX: run.player.x,
    targetY: run.player.y,
    telegraphUntil: executeAt,
  };
  addLogs(run, `${getBossLabel(enemy)}가 ${BOSS_PATTERN_LABELS[pattern]}을 준비합니다.`);
  createBossTelegraph(run, enemy, pattern, executeAt);
}

function executeBossAction(
  run: RunState,
  room: RoomDefinition,
  enemy: EnemyState,
  now: number,
) {
  const pattern = enemy.boss?.currentPattern?.id ?? null;

  if (pattern === "bossLunge") {
    const lunge = normalize({ x: enemy.targetX - enemy.x, y: enemy.targetY - enemy.y });

    enemy.phase = "lunging";
    enemy.phaseUntil = now + (enemy.boss?.phase ?? 1) * 0.07 + 0.3;
    enemy.vx = lunge.x * (560 + (enemy.boss?.phase ?? 1) * 40);
    enemy.vy = lunge.y * (560 + (enemy.boss?.phase ?? 1) * 40);
    return;
  }

  if (pattern === "ringBurst") {
    const phase = enemy.boss?.phase ?? 1;
    fireRadialProjectiles(run, enemy.x, enemy.y, 7 + phase * 4, enemy.attack, "#f9a8d4", 260 + phase * 28);
  } else if (pattern === "fanVolley") {
    const phase = enemy.boss?.phase ?? 1;
    fireFanProjectiles(run, enemy.x, enemy.y, { x: enemy.targetX, y: enemy.targetY }, 5 + phase * 2, enemy.attack + 1, "#fda4af", 350 + phase * 24);
  } else if (pattern === "mirrorClone") {
    createMirrorCloneVolley(run, enemy);
  } else if (pattern === "summonGuard") {
    summonBossAdds(run, room, enemy);
  }

  if (enemy.boss) {
    enemy.boss.currentPattern = null;
  }
  enemy.phase = "moving";
  enemy.cooldown = getBossCooldown(enemy);
}

function selectBossPattern(enemy: EnemyState, floor: number, now: number): BossPatternId {
  const boss = enemy.boss;

  if (!boss) {
    return "ringBurst";
  }

  const phase = boss.phase;
  const indexSeed = Math.floor(now * 1.37 + floor + phase * 2);
  const pick = (patterns: BossPatternId[]) => patterns[indexSeed % patterns.length];

  if (boss.kind === "riftGatekeeper") {
    return pick(
      phase >= 3
        ? ["bossLunge", "bossLunge", "fanVolley", "delayedRift", "ringBurst"]
        : ["bossLunge", "fanVolley", "delayedRift"],
    );
  }

  if (boss.kind === "armoredJudicator") {
    return pick(
      phase >= 3
        ? ["shockwaveLine", "laserSweep", "ringBurst", "fanVolley"]
        : ["shockwaveLine", "ringBurst", "laserSweep"],
    );
  }

  if (boss.kind === "resonanceHierophant") {
    return pick(
      phase >= 3
        ? ["summonGuard", "laserSweep", "delayedRift", "ringBurst"]
        : ["summonGuard", "ringBurst", "laserSweep"],
    );
  }

  if (boss.kind === "echoSplinterCore") {
    return pick(
      phase >= 3
        ? ["mirrorClone", "fanVolley", "delayedRift", "ringBurst"]
        : ["mirrorClone", "fanVolley", "ringBurst"],
    );
  }

  if (boss.kind === "gravityObserver") {
    return pick(
      phase >= 3
        ? ["gravityPulse", "laserSweep", "ringBurst", "delayedRift"]
        : ["gravityPulse", "ringBurst", "laserSweep"],
    );
  }

  if (boss.kind === "waveCrusher") {
    return pick(
      phase >= 3
        ? ["shockwaveLine", "fanVolley", "bossLunge", "ringBurst"]
        : ["shockwaveLine", "fanVolley", "bossLunge"],
    );
  }

  return pick(
    phase >= 3
      ? ["gravityPulse", "mirrorClone", "laserSweep", "delayedRift", "ringBurst", "summonGuard"]
      : ["ringBurst", "fanVolley", "delayedRift", "laserSweep"],
  );
}

function getBossTelegraphDuration(pattern: BossPatternId, phase: number) {
  if (pattern === "laserSweep" || pattern === "shockwaveLine") {
    return Math.max(0.58, 0.92 - phase * 0.06);
  }

  if (pattern === "bossLunge") {
    return Math.max(0.55, 0.78 - phase * 0.04);
  }

  return Math.max(0.62, 0.86 - phase * 0.045);
}

function createBossTelegraph(
  run: RunState,
  enemy: EnemyState,
  pattern: BossPatternId,
  executeAt: number,
) {
  const phase = enemy.boss?.phase ?? 1;
  const angle = Math.atan2(run.player.y - enemy.y, run.player.x - enemy.x);

  if (pattern === "laserSweep") {
    run.attackZones.push({
      activeUntil: executeAt + 0.9,
      angle,
      damage: enemy.attack + 5 + phase,
      hasHitPlayer: false,
      id: createId(run, "laser-sweep"),
      kind: "laserSweep",
      length: 980,
      radius: 0,
      sweepSpeed: 0.8 + phase * 0.18,
      telegraphUntil: executeAt,
      width: 22 + phase * 2,
      x: enemy.x,
      y: enemy.y,
    });
  } else if (pattern === "shockwaveLine") {
    run.attackZones.push({
      activeUntil: executeAt + 0.28,
      angle,
      damage: enemy.attack + 7 + phase,
      hasHitPlayer: false,
      id: createId(run, "shockwave-line"),
      kind: "shockwaveLine",
      length: 980,
      radius: 0,
      telegraphUntil: executeAt,
      width: 42 + phase * 5,
      x: enemy.x,
      y: enemy.y,
    });
  } else if (pattern === "gravityPulse") {
    run.attackZones.push({
      activeUntil: executeAt + 0.9,
      damage: phase >= 3 ? enemy.attack : 0,
      hasHitPlayer: false,
      id: createId(run, "gravity-pulse"),
      kind: "gravityPulse",
      radius: 185 + phase * 24,
      strength: phase % 2 === 0 ? -180 : 220,
      telegraphUntil: executeAt,
      x: enemy.x,
      y: enemy.y,
    });
  } else if (pattern === "delayedRift") {
    const offsets = [
      { x: 0, y: 0 },
      { x: 86, y: -42 },
      { x: -86, y: 42 },
      { x: 42, y: 88 },
    ].slice(0, phase >= 4 ? 4 : phase >= 2 ? 3 : 2);

    offsets.forEach((offset) => {
      run.attackZones.push({
        activeUntil: executeAt + 0.26,
        damage: enemy.attack + 4 + phase,
        hasHitPlayer: false,
        id: createId(run, "delayed-rift"),
        kind: "delayedRift",
        radius: 58 + phase * 4,
        telegraphUntil: executeAt,
        x: clampToRoom(run.player.x + offset.x, 58, "x"),
        y: clampToRoom(run.player.y + offset.y, 58, "y"),
      });
    });
  }
}

function summonBossAdds(run: RunState, room: RoomDefinition, enemy: EnemyState) {
  const addKinds: EnemyKind[] = enemy.boss?.kind === "resonanceHierophant"
    ? ["afterimageShard", "regenerationPriest"]
    : ["afterimageShard", "stalker"];
  const positions = [
    { x: enemy.x - 96, y: enemy.y + 70 },
    { x: enemy.x + 96, y: enemy.y + 70 },
  ];

  addKinds.forEach((kind, index) => {
    run.enemies.push(
      createEnemy({
        attackBonus: Math.max(0, run.floor - 1),
        bossKind: null,
        healthBonus: Math.max(0, run.floor * 3),
        id: createId(run, kind),
        index,
        kind,
        modifier: room.modifier,
        point: positions[index],
      }),
    );
  });
  addLogs(run, `${getBossLabel(enemy)}가 균열 하수인을 불러냅니다.`);
}

function getBossCooldown(enemy: EnemyState) {
  const phase = enemy.boss?.phase ?? 1;

  return Math.max(0.72, 2.08 - phase * 0.24);
}

function updateAttackZones(run: RunState, deltaSeconds: number, now: number) {
  const zones: AttackZone[] = [];
  const room = getRoom(run.dungeon, run.currentRoomId);

  for (const zone of run.attackZones) {
    if (now > zone.activeUntil) {
      continue;
    }

    if (zone.kind === "gravityPulse" && now >= zone.telegraphUntil) {
      applyGravityPulse(run, room, zone, deltaSeconds);
    }

    if (
      now >= zone.telegraphUntil &&
      zone.damage > 0 &&
      !zone.hasHitPlayer &&
      playerInsideAttackZone(zone, run.player, now)
    ) {
      damagePlayer(run, zone.damage, now, "위험 공격 적중");
      zone.hasHitPlayer = true;
    }

    zones.push(zone);
  }

  run.attackZones = zones;
}

function applyGravityPulse(
  run: RunState,
  room: RoomDefinition,
  zone: AttackZone,
  deltaSeconds: number,
) {
  const strength = zone.strength ?? 0;

  if (strength === 0) {
    return;
  }

  const playerDistance = distance(zone, run.player);

  if (playerDistance < zone.radius) {
    const pull = normalize({ x: zone.x - run.player.x, y: zone.y - run.player.y });
    const falloff = 1 - playerDistance / zone.radius;
    const amount = strength * falloff * deltaSeconds;

    moveEntity(room, run.player, pull.x * amount, pull.y * amount);
  }

  run.projectiles.forEach((projectile) => {
    const projectileDistance = distance(zone, projectile);

    if (projectileDistance >= zone.radius) {
      return;
    }

    const pull = normalize({ x: zone.x - projectile.x, y: zone.y - projectile.y });
    const falloff = 1 - projectileDistance / zone.radius;
    const amount = strength * falloff * deltaSeconds * 1.15;

    projectile.vx += pull.x * amount;
    projectile.vy += pull.y * amount;
  });
}

function playerInsideAttackZone(zone: AttackZone, player: PlayerState, now: number) {
  if (zone.kind === "laserSweep" || zone.kind === "shockwaveLine") {
    return pointInsideLineZone(zone, player, now, player.radius);
  }

  return distance(zone, player) <= zone.radius + player.radius;
}

function pointInsideLineZone(
  zone: AttackZone,
  point: { x: number; y: number },
  now: number,
  radius: number,
) {
  const angle = getZoneAngle(zone, now);
  const dx = point.x - zone.x;
  const dy = point.y - zone.y;
  const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
  const side = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const lengthLimit = zone.length ?? 0;
  const halfWidth = (zone.width ?? 1) / 2 + radius;

  return forward >= -radius && forward <= lengthLimit && Math.abs(side) <= halfWidth;
}

function getZoneAngle(zone: AttackZone, now: number) {
  const baseAngle = zone.angle ?? 0;

  if (zone.kind !== "laserSweep" || now < zone.telegraphUntil) {
    return baseAngle;
  }

  return baseAngle + (zone.sweepSpeed ?? 0) * (now - zone.telegraphUntil);
}

function updateRoomModifier(run: RunState, deltaSeconds: number, now: number) {
  const room = getRoom(run.dungeon, run.currentRoomId);

  if (room.modifier === "barrage" && run.phase === "playing") {
    const currentBeat = Math.floor(now * 1.15);
    const previousBeat = Math.floor((now - deltaSeconds) * 1.15);

    if (currentBeat !== previousBeat && run.enemies.length > 0) {
      const x = 120 + ((currentBeat * 137) % 720);
      const direction = normalize({ x: run.player.x - x, y: run.player.y - 70 });

      run.projectiles.push(
        createProjectile({
          color: "#fb7185",
          damage: 7 + Math.floor(run.floor / 2),
          owner: "enemy",
          radius: 6,
          speed: 270,
          ttl: 2.4,
          vector: direction,
          x,
          y: 72,
        }, run),
      );
    }
  }

  if (
    room.modifier === "healingWell" &&
    run.clearedRoomIds.includes(room.id) &&
    distance(run.player, { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 }) < 72
  ) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 8 * deltaSeconds);
  }
}

function collectPickups(run: RunState) {
  const remaining: Pickup[] = [];

  for (const pickup of run.pickups) {
    if (distance(pickup, run.player) > pickup.radius + run.player.radius) {
      remaining.push(pickup);
      continue;
    }

    claimRoomReward(run, pickup.id);

    if (pickup.type === "artifactCache") {
      run.phase = "choosingRelic";
      run.pendingRelicChoice = {
        options: createArtifactOptions(run),
      };
      addLogs(run, ["유물 상자를 열었습니다. 하나를 선택하세요."]);
      continue;
    }

    applyPickup(run, pickup.type);
  }

  run.pickups = remaining;
}

function checkRoomCompletion(run: RunState) {
  const room = getRoom(run.dungeon, run.currentRoomId);

  if (run.enemies.length > 0 || run.clearedRoomIds.includes(room.id)) {
    return;
  }

  run.clearedRoomIds.push(room.id);

  if (room.kind === "boss") {
    addLogs(run, ["보스를 쓰러뜨렸습니다. 중앙 포탈이 열립니다."]);
  } else if (room.kind === "elite") {
    addLogs(run, ["엘리트 방을 제압했습니다. 큰 보상이 나타납니다."]);
  } else if (room.kind === "event" || room.kind === "treasure") {
    addLogs(run, ["방 중앙의 보상이 안정화됩니다."]);
  } else if (room.kind === "combat") {
    addLogs(run, ["방의 위협을 정리했습니다. 문이 열립니다."]);
  } else if (room.kind === "portal") {
    addLogs(run, ["층문이 깨어났습니다. 중앙 포탈로 이동하세요."]);
  }

  spawnRoomReward(run, room);
}

function checkPortal(run: RunState) {
  const room = getRoom(run.dungeon, run.currentRoomId);

  if (
    !["boss", "portal"].includes(room.kind) ||
    !run.clearedRoomIds.includes(room.id) ||
    distance(run.player, { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 }) > 42
  ) {
    return;
  }

  const nextRun = createNextFloorRun(run);
  Object.assign(run, nextRun);
}

function regenerateShield(run: RunState, deltaSeconds: number, now: number) {
  const player = run.player;

  if (player.shield >= player.maxShield || now - player.lastDamageAt < SHIELD_REGEN_DELAY) {
    return;
  }

  const before = player.shield;
  player.shield = Math.min(player.maxShield, player.shield + SHIELD_REGEN_PER_SECOND * deltaSeconds);

  if (player.shield - before >= 1 && now - run.lastShieldLogAt > 2) {
    run.lastShieldLogAt = now;
    addLogs(run, ["Shield가 재생되기 시작했습니다."]);
  }
}

function tryRoomTransition(run: RunState, input: InputState) {
  const room = getRoom(run.dungeon, run.currentRoomId);

  if (!canUseExit(room, run.clearedRoomIds)) {
    return;
  }

  const player = run.player;
  const nearMiddleY = Math.abs(player.y - VIEWPORT_HEIGHT / 2) < 64;
  const nearMiddleX = Math.abs(player.x - VIEWPORT_WIDTH / 2) < 64;
  let direction: DirectionName | null = null;

  if (input.left && player.x <= 72 && nearMiddleY) {
    direction = "west";
  } else if (input.right && player.x >= VIEWPORT_WIDTH - 72 && nearMiddleY) {
    direction = "east";
  } else if (input.up && player.y <= 72 && nearMiddleX) {
    direction = "north";
  } else if (input.down && player.y >= VIEWPORT_HEIGHT - 72 && nearMiddleX) {
    direction = "south";
  }

  if (!direction) {
    return;
  }

  const exit = getExit(room, direction);

  if (!exit) {
    return;
  }

  enterRoom(run, exit.to, direction);
}

function enterRoom(
  run: RunState,
  roomId: string,
  entryDirection: DirectionName | null,
) {
  const room = getRoom(run.dungeon, roomId);

  run.currentRoomId = room.id;
  run.attackZones = [];
  run.projectiles = run.projectiles.filter((projectile) => projectile.owner === "player");
  run.pickups = [];

  if (!run.discoveredRoomIds.includes(room.id)) {
    run.discoveredRoomIds.push(room.id);
    addLogs(run, [`새 방 발견: ${getRoomKindLabel(room.kind)}.`]);
  }

  if (entryDirection) {
    const entrance = getEntrancePosition(entryDirection);

    run.player.x = entrance.x;
    run.player.y = entrance.y;
  }

  if (run.clearedRoomIds.includes(room.id)) {
    run.enemies = [];
    spawnRoomReward(run, room);
    return;
  }

  run.enemies = spawnEnemies(run.dungeon, room, run);

  if (run.enemies.some((enemy) => enemy.kind !== "stalker")) {
    addLogs(run, ["특수 괴수가 방 안에서 움직입니다."]);
  }
}

function spawnEnemies(
  dungeon: DungeonDefinition,
  room: RoomDefinition,
  run: RunState,
): EnemyState[] {
  const rng = createRng(`${dungeon.seed}:floor:${dungeon.floor}:spawn:${room.id}`);
  const spawnPoints = [
    { x: VIEWPORT_WIDTH * 0.5, y: 132 },
    { x: VIEWPORT_WIDTH * 0.72, y: 202 },
    { x: VIEWPORT_WIDTH * 0.28, y: 204 },
    { x: VIEWPORT_WIDTH * 0.68, y: 420 },
    { x: VIEWPORT_WIDTH * 0.32, y: 420 },
    { x: VIEWPORT_WIDTH * 0.5, y: 470 },
  ];

  return room.enemyKinds.map((kind, index) => {
    const point = spawnPoints[index % spawnPoints.length];

    return createEnemy({
      attackBonus: dungeon.tuning.enemyAttackBonus,
      bossKind: kind === "boss" ? room.bossKind : null,
      healthBonus: dungeon.tuning.enemyHealthBonus,
      id: createId(run, kind),
      index,
      kind,
      modifier: room.modifier,
      point: {
        x: point.x + rng.int(-30, 30),
        y: point.y + rng.int(-20, 20),
      },
    });
  });
}

type CreateEnemyOptions = {
  attackBonus: number;
  bossKind: BossKind | null;
  healthBonus: number;
  id: string;
  index: number;
  kind: EnemyKind;
  modifier: RoomDefinition["modifier"];
  point: Vector;
};

function createEnemy({
  attackBonus,
  bossKind,
  healthBonus,
  id,
  index,
  kind,
  modifier,
  point,
}: CreateEnemyOptions): EnemyState {
  if (kind === "boss") {
    const selectedBoss = bossKind ?? "riftGatekeeper";
    const bossStats: Record<BossKind, {
      armor: number;
      attackBonus: number;
      baseHp: number;
      healthScale: number;
      radius: number;
      speed: number;
    }> = {
      armoredJudicator: { armor: 5, attackBonus: 2, baseHp: 205, healthScale: 3.2, radius: 38, speed: 52 },
      deepTuner: { armor: 3, attackBonus: 4, baseHp: 270, healthScale: 3.6, radius: 38, speed: 68 },
      echoSplinterCore: { armor: 1, attackBonus: 0, baseHp: 185, healthScale: 2.7, radius: 32, speed: 78 },
      gravityObserver: { armor: 3, attackBonus: 1, baseHp: 205, healthScale: 2.9, radius: 36, speed: 54 },
      resonanceHierophant: { armor: 2, attackBonus: 1, baseHp: 225, healthScale: 3, radius: 32, speed: 63 },
      riftGatekeeper: { armor: 2, attackBonus: 0, baseHp: 158, healthScale: 2.4, radius: 34, speed: 72 },
      waveCrusher: { armor: 3, attackBonus: 3, baseHp: 215, healthScale: 3.1, radius: 38, speed: 75 },
    };
    const stats = bossStats[selectedBoss];
    const hp = Math.round(stats.baseHp + healthBonus * stats.healthScale);

    return {
      action: null,
      armor: stats.armor,
      attack: 10 + attackBonus + stats.attackBonus,
      boss: {
        currentPattern: null,
        kind: selectedBoss,
        phase: 1,
        phaseLogged: false,
      },
      cooldown: 1,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: stats.radius,
      speed: stats.speed,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  const eliteMultiplier = modifier === "eliteBoost" ? 1.25 : 1;

  if (kind === "guardian") {
    const hp = Math.round((46 + healthBonus) * eliteMultiplier);

    return {
      action: null,
      armor: 3,
      attack: Math.round((9 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0.8 + index * 0.25,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 25,
      speed: 68,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "riftApostle") {
    const hp = Math.round((28 + Math.floor(healthBonus * 0.75)) * eliteMultiplier);

    return {
      action: null,
      armor: 0,
      attack: Math.round((8 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0.65 + index * 0.18,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 20,
      speed: 74,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "afterimageShard") {
    const hp = Math.round((12 + Math.floor(healthBonus * 0.45)) * eliteMultiplier);

    return {
      action: null,
      armor: 0,
      attack: Math.round((5 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0.25 + index * 0.12,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 13,
      speed: 168,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "resonanceTurret") {
    const hp = Math.round((24 + Math.floor(healthBonus * 0.6)) * eliteMultiplier);

    return {
      action: null,
      armor: 1,
      attack: Math.round((7 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0.9 + index * 0.18,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 19,
      speed: 0,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "warpLeaper") {
    const hp = Math.round((26 + Math.floor(healthBonus * 0.65)) * eliteMultiplier);

    return {
      action: null,
      armor: 0,
      attack: Math.round((8 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0.75 + index * 0.16,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 18,
      speed: 98,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "regenerationPriest") {
    const hp = Math.round((30 + Math.floor(healthBonus * 0.7)) * eliteMultiplier);

    return {
      action: null,
      armor: 0,
      attack: Math.round((6 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 1.2 + index * 0.2,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 18,
      speed: 74,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "riftMine") {
    const hp = Math.round((18 + Math.floor(healthBonus * 0.55)) * eliteMultiplier);

    return {
      action: null,
      armor: 0,
      attack: Math.round((9 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 0,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 16,
      speed: 70,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  if (kind === "gravityNode") {
    const hp = Math.round((38 + Math.floor(healthBonus * 0.85)) * eliteMultiplier);

    return {
      action: null,
      armor: 2,
      attack: Math.round((7 + attackBonus) * eliteMultiplier),
      boss: null,
      cooldown: 1.4 + index * 0.12,
      dashHitUntil: 0,
      hp,
      id,
      kind,
      maxHp: hp,
      phase: "moving",
      phaseUntil: 0,
      radius: 22,
      speed: 32,
      targetX: point.x,
      targetY: point.y,
      vx: 0,
      vy: 0,
      x: point.x,
      y: point.y,
    };
  }

  const hp = Math.round((22 + Math.floor(healthBonus * 0.7)) * eliteMultiplier);

  return {
    action: null,
    armor: 0,
    attack: Math.round((7 + attackBonus) * eliteMultiplier),
    boss: null,
    cooldown: 0.4 + index * 0.16,
    dashHitUntil: 0,
    hp,
    id,
    kind,
    maxHp: hp,
    phase: "moving",
    phaseUntil: 0,
    radius: 18,
    speed: 112,
    targetX: point.x,
    targetY: point.y,
    vx: 0,
    vy: 0,
    x: point.x,
    y: point.y,
  };
}

function spawnRoomReward(run: RunState, room: RoomDefinition) {
  if (
    room.reward === "none" ||
    run.roomRewardClaimedIds.includes(room.id) ||
    run.pickups.some((pickup) => pickup.id === `reward-${room.id}`)
  ) {
    return;
  }

  run.pickups.push({
    id: `reward-${room.id}`,
    radius: 18,
    type: room.reward,
    x: VIEWPORT_WIDTH / 2,
    y: room.kind === "boss" || room.kind === "portal" ? VIEWPORT_HEIGHT / 2 + 96 : VIEWPORT_HEIGHT / 2,
  });
}

function claimRoomReward(run: RunState, pickupId: string) {
  if (!pickupId.startsWith("reward-")) {
    return;
  }

  const roomId = pickupId.replace("reward-", "");

  if (!run.roomRewardClaimedIds.includes(roomId)) {
    run.roomRewardClaimedIds.push(roomId);
  }
}

function applyPickup(run: RunState, type: PickupType) {
  const player = run.player;

  if (type === "shieldCrystal") {
    player.maxShield += 4;
    player.shield = Math.min(player.maxShield, player.shield + 16);
    addLogs(run, ["보호막 결정 획득: 최대 Shield +4."]);
    return;
  }

  if (type === "healingCrystal") {
    const heal = 18 + run.floor * 2;

    player.hp = Math.min(player.maxHp, player.hp + heal);
    addLogs(run, [`회복 수정 획득: HP +${heal}.`]);
    return;
  }

  if (type === "bladeResonance") {
    player.bladeResonance += 1;
    addLogs(run, [`광검 공명석 ${player.bladeResonance}/2.`]);

    if (player.bladeResonance >= 2 && player.evolution !== "dualBladeAssault") {
      player.evolution = "dualBladeAssault";
      player.attack += 2;
      player.dashDamage += 4;
      player.dashCooldown = Math.max(1.1, player.dashCooldown - 0.45);
      addLogs(run, ["진화: 쌍검 돌격형으로 각성했습니다."]);
    }
  }
}

function createArtifactOptions(run: RunState): ArtifactId[] {
  const rng = createRng(
    `${run.seed}:artifact:${run.floor}:${run.currentRoomId}:${run.killCount}:${run.nextId}`,
  );

  return [...ARTIFACT_IDS]
    .sort(
      (left, right) =>
        run.player.artifacts[left] - run.player.artifacts[right] || rng.next() - 0.5,
    )
    .slice(0, 3);
}

function applyArtifact(run: RunState, artifactId: ArtifactId) {
  const player = run.player;
  const nextRank = player.artifacts[artifactId] + 1;

  player.artifacts = {
    ...player.artifacts,
    [artifactId]: nextRank,
  };

  if (artifactId === "bladeAmplifier") {
    player.attack += 2;
    addLogs(run, ["유물 선택: 광검 증폭.", "효과 적용: 공격력 +2."]);
    return;
  }

  if (artifactId === "shieldResonance") {
    player.maxShield += 8;
    player.shield = Math.min(player.maxShield, player.shield + 12);
    addLogs(run, ["유물 선택: 보호막 공명.", "효과 적용: 최대 Shield +8."]);
    return;
  }

  if (artifactId === "battleForesight") {
    addLogs(run, ["유물 선택: 전투 예지.", "효과 적용: 피격 후 다음 광탄 강화."]);
    return;
  }

  if (artifactId === "phaseAcceleration") {
    player.dashCooldown = Math.max(1.1, player.dashCooldown - 0.3);
    player.dashCooldownRemaining = Math.min(player.dashCooldownRemaining, player.dashCooldown);
    addLogs(run, ["유물 선택: 차원 가속.", "효과 적용: 회피 돌진 쿨다운 감소."]);
    return;
  }

  if (artifactId === "energyAbsorption") {
    player.killShieldRestore += 4;
    addLogs(run, ["유물 선택: 에너지 흡수.", "효과 적용: 처치 시 Shield +4."]);
    return;
  }

  if (artifactId === "piercingLance") {
    player.piercingShots += 1;
    addLogs(run, ["유물 선택: 관통 광창.", "효과 적용: 광탄 관통 +1."]);
    return;
  }

  if (artifactId === "splitPrism") {
    player.splitShotCount += 1;
    player.fireCooldown += 0.03;
    addLogs(run, ["유물 선택: 분열 프리즘.", "효과 적용: 보조 광탄 2발 추가."]);
    return;
  }

  if (artifactId === "dashShockwave") {
    player.dashDamage += 2;
    addLogs(run, ["유물 선택: 돌진 충격파.", "효과 적용: 돌진 시작 시 범위 피해."]);
    return;
  }

  if (artifactId === "shieldRebuke") {
    player.shieldRetaliationDamage += 5;
    addLogs(run, ["유물 선택: 보호막 반격.", "효과 적용: Shield 피격 시 주변 반격."]);
    return;
  }

  if (artifactId === "killBurst") {
    player.killExplosionDamage += 5;
    addLogs(run, ["유물 선택: 처치 폭발.", "효과 적용: 처치 시 주변 폭발."]);
    return;
  }

  if (artifactId === "desperationCircuit") {
    player.attack += 1;
    addLogs(run, ["유물 선택: 절박 회로.", "효과 적용: 저체력 공격 속도 증가."]);
    return;
  }

  player.dashDamage += 3;
  addLogs(run, ["유물 선택: 집중 파동.", "효과 적용: 돌진 충돌 피해 +3."]);
}

function damageDashOverlaps(run: RunState, now: number) {
  for (const enemy of run.enemies) {
    if (now < enemy.dashHitUntil || !circlesOverlap(run.player, enemy)) {
      continue;
    }

    enemy.dashHitUntil = now + 0.45;
    damageEnemy(run, enemy, run.player.dashDamage);
  }
}

function damageEnemy(run: RunState, enemy: EnemyState, amount: number) {
  const damage = Math.max(1, Math.round(amount - enemy.armor));

  enemy.hp -= damage;
  addFloatingText(run, `${damage}`, enemy.x, enemy.y - 18, "#fff4bf");

  if (enemy.hp > 0) {
    return;
  }

  run.killCount += 1;
  run.enemies = run.enemies.filter((entry) => entry.id !== enemy.id);
  addLogs(run, `${getBossLabel(enemy)} 처치.`);

  if (run.player.killShieldRestore > 0) {
    const before = run.player.shield;
    run.player.shield = Math.min(
      run.player.maxShield,
      run.player.shield + run.player.killShieldRestore,
    );
    addLogs(run, [`에너지 흡수: Shield +${Math.round(run.player.shield - before)}.`]);
  }

  if (run.player.killExplosionDamage > 0) {
    damageEnemiesAround(run, enemy.x, enemy.y, 96, run.player.killExplosionDamage);
  }

  addFloatingText(run, "break", enemy.x, enemy.y - 34, "#8fd3ff");
}

function damagePlayer(run: RunState, amount: number, now: number, reason: string) {
  const player = run.player;

  if (now < player.invulnerableUntil) {
    return;
  }

  const shieldDamage = Math.min(player.shield, amount);
  const hpDamage = amount - shieldDamage;

  player.shield -= shieldDamage;
  player.hp = Math.max(0, player.hp - hpDamage);
  player.invulnerableUntil = now + 0.42;
  player.lastDamageAt = now;

  if (player.artifacts.battleForesight > 0) {
    player.nextShotBonus += player.artifacts.battleForesight * 4;
  }

  if (shieldDamage > 0 && player.shieldRetaliationDamage > 0) {
    damageEnemiesAround(run, player.x, player.y, 118, player.shieldRetaliationDamage);
    addFloatingText(run, "rebuke", player.x, player.y - 34, "#67e8f9");
  }

  addFloatingText(run, `-${Math.round(amount)}`, player.x, player.y - 24, "#ffb4a6");
  addLogs(run, `${reason}: ${Math.round(amount)} 피해.`);

  if (player.hp <= 0) {
    run.phase = "gameover";
    addLogs(run, ["생명력이 고갈되어 쓰러졌습니다."]);
  }
}

function damageEnemiesAround(
  run: RunState,
  x: number,
  y: number,
  radius: number,
  amount: number,
) {
  const targets = [...run.enemies].filter((enemy) => distance(enemy, { x, y }) <= radius + enemy.radius);

  targets.forEach((enemy) => {
    if (run.enemies.some((entry) => entry.id === enemy.id)) {
      damageEnemy(run, enemy, amount);
    }
  });
}

function fireRadialProjectiles(
  run: RunState,
  x: number,
  y: number,
  count: number,
  damage: number,
  color: string,
  speed: number,
) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + run.elapsed * 0.35;
    const vector = { x: Math.cos(angle), y: Math.sin(angle) };

    run.projectiles.push(
      createProjectile({
        color,
        damage,
        owner: "enemy",
        radius: 7,
        speed,
        ttl: 2.4,
        vector,
        x: x + vector.x * 24,
        y: y + vector.y * 24,
      }, run),
    );
  }
}

function fireFanProjectiles(
  run: RunState,
  x: number,
  y: number,
  target: Vector,
  count: number,
  damage: number,
  color: string,
  speed: number,
) {
  const baseAngle = Math.atan2(target.y - y, target.x - x);
  const spread = Math.PI * 0.62;

  for (let index = 0; index < count; index += 1) {
    const ratio = count <= 1 ? 0.5 : index / (count - 1);
    const angle = baseAngle - spread / 2 + spread * ratio;
    const vector = { x: Math.cos(angle), y: Math.sin(angle) };

    run.projectiles.push(
      createProjectile({
        color,
        damage,
        owner: "enemy",
        radius: 7,
        speed,
        ttl: 2.35,
        vector,
        x: x + vector.x * 26,
        y: y + vector.y * 26,
      }, run),
    );
  }
}

function createMirrorCloneVolley(run: RunState, enemy: EnemyState) {
  const phase = enemy.boss?.phase ?? 1;
  const origins = [
    { x: clampToRoom(enemy.x - 132, enemy.radius, "x"), y: clampToRoom(enemy.y + 54, enemy.radius, "y") },
    { x: clampToRoom(enemy.x + 132, enemy.radius, "x"), y: clampToRoom(enemy.y + 54, enemy.radius, "y") },
  ];

  origins.forEach((origin, index) => {
    addFloatingText(run, "clone", origin.x, origin.y - 22, "#c4b5fd");
    fireFanProjectiles(
      run,
      origin.x,
      origin.y,
      { x: run.player.x, y: run.player.y },
      3 + phase,
      Math.max(5, Math.round(enemy.attack * 0.72)),
      index === 0 ? "#c4b5fd" : "#f0abfc",
      280 + phase * 28,
    );
  });

  if (phase >= 3) {
    fireRadialProjectiles(run, enemy.x, enemy.y, 8 + phase * 2, enemy.attack - 1, "#ddd6fe", 240 + phase * 20);
  }
}

function getPlayerSpeedForRoom(player: PlayerState, room: RoomDefinition) {
  if (
    room.modifier === "slowField" &&
    distance(player, { x: VIEWPORT_WIDTH / 2, y: VIEWPORT_HEIGHT / 2 }) < 190
  ) {
    return player.speed * 0.66;
  }

  return player.speed;
}

function getEffectiveFireCooldown(player: PlayerState) {
  if (player.artifacts.desperationCircuit <= 0) {
    return player.fireCooldown;
  }

  const hpRatio = player.hp / player.maxHp;

  if (hpRatio > 0.42) {
    return player.fireCooldown;
  }

  return Math.max(0.09, player.fireCooldown * (0.72 - player.artifacts.desperationCircuit * 0.06));
}

function rotateVector(vector: Vector, radians: number): Vector {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function getBossLabel(enemy: EnemyState) {
  return enemy.boss ? BOSS_LABELS[enemy.boss.kind] : ENEMY_LABELS[enemy.kind];
}

function createProjectile(
  options: {
    color: string;
    damage: number;
    owner: Projectile["owner"];
    pierceRemaining?: number;
    radius: number;
    speed: number;
    ttl: number;
    vector: Vector;
    x: number;
    y: number;
  },
  run: RunState,
): Projectile {
  return {
    color: options.color,
    damage: options.damage,
    hitEnemyIds: [],
    id: createId(run, "shot"),
    owner: options.owner,
    pierceRemaining: options.pierceRemaining ?? 0,
    radius: options.radius,
    ttl: options.ttl,
    vx: options.vector.x * options.speed,
    vy: options.vector.y * options.speed,
    x: options.x,
    y: options.y,
  };
}

function moveEntity(
  room: RoomDefinition,
  entity: { radius: number; x: number; y: number },
  dx: number,
  dy: number,
) {
  const nextX = clampToRoom(entity.x + dx, entity.radius, "x");

  if (!room.obstacles.some((obstacle) => circleIntersectsRect(nextX, entity.y, entity.radius, obstacle))) {
    entity.x = nextX;
  }

  const nextY = clampToRoom(entity.y + dy, entity.radius, "y");

  if (!room.obstacles.some((obstacle) => circleIntersectsRect(entity.x, nextY, entity.radius, obstacle))) {
    entity.y = nextY;
  }
}

function projectileHitsWallOrObstacle(projectile: Projectile, obstacles: Obstacle[]) {
  if (
    projectile.x < 44 ||
    projectile.x > VIEWPORT_WIDTH - 44 ||
    projectile.y < 44 ||
    projectile.y > VIEWPORT_HEIGHT - 44
  ) {
    return true;
  }

  return obstacles.some((obstacle) =>
    circleIntersectsRect(projectile.x, projectile.y, projectile.radius, obstacle),
  );
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: Obstacle) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));

  return Math.hypot(x - closestX, y - closestY) < radius;
}

function circlesOverlap(
  a: { radius: number; x: number; y: number },
  b: { radius: number; x: number; y: number },
) {
  return distance(a, b) <= a.radius + b.radius;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: Vector): Vector {
  const magnitude = length(vector);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function length(vector: Vector) {
  return Math.hypot(vector.x, vector.y);
}

function createId(run: RunState, prefix: string) {
  const id = `${prefix}-${run.nextId}`;
  run.nextId += 1;
  return id;
}

function addLogs(run: RunState, entries: string[] | string) {
  const nextEntries = Array.isArray(entries) ? entries : [entries];

  run.logs = [...run.logs, ...nextEntries].slice(-MAX_LOGS);
}

function addFloatingText(
  run: RunState,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  run.floatingTexts.push({
    color,
    id: createId(run, "float"),
    text,
    ttl: 0.72,
    x,
    y,
  });
}

function updateFloatingTexts(run: RunState, deltaSeconds: number) {
  run.floatingTexts = run.floatingTexts
    .map((text) => ({
      ...text,
      ttl: text.ttl - deltaSeconds,
      y: text.y - deltaSeconds * 28,
    }))
    .filter((text) => text.ttl > 0);
}

function createRoomSnapshots(run: RunState): RoomSnapshot[] {
  return run.dungeon.rooms.map((room) => ({
    cleared: run.clearedRoomIds.includes(room.id),
    current: room.id === run.currentRoomId,
    discovered: run.discoveredRoomIds.includes(room.id),
    gridX: room.gridX,
    gridY: room.gridY,
    id: room.id,
    kind: room.kind,
    modifier: room.modifier,
  }));
}

function describeDifficulty(dungeon: DungeonDefinition) {
  return `난이도 상승: 방 ${dungeon.rooms.length}개, 특수 위협 ${dungeon.tuning.specialEnemyBudget}.`;
}

function getRoomKindLabel(kind: RoomDefinition["kind"]) {
  if (kind === "boss") {
    return "보스 방";
  }

  if (kind === "elite") {
    return "엘리트 방";
  }

  if (kind === "event") {
    return "이벤트 방";
  }

  if (kind === "portal") {
    return "층문 방";
  }

  if (kind === "treasure") {
    return "유물 방";
  }

  if (kind === "combat") {
    return "전투 방";
  }

  return "진입 방";
}

function drawRoom(context: CanvasRenderingContext2D, room: RoomDefinition, run: RunState) {
  const gradient = context.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  gradient.addColorStop(0, "#1d202b");
  gradient.addColorStop(1, "#0b0c12");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  context.fillStyle = FLOOR_COLOR;
  context.fillRect(46, 46, VIEWPORT_WIDTH - 92, VIEWPORT_HEIGHT - 92);

  context.strokeStyle = "rgba(255,244,191,0.06)";
  context.lineWidth = 1;
  for (let x = 78; x < VIEWPORT_WIDTH - 78; x += 42) {
    context.beginPath();
    context.moveTo(x, 50);
    context.lineTo(x, VIEWPORT_HEIGHT - 50);
    context.stroke();
  }
  for (let y = 78; y < VIEWPORT_HEIGHT - 78; y += 42) {
    context.beginPath();
    context.moveTo(50, y);
    context.lineTo(VIEWPORT_WIDTH - 50, y);
    context.stroke();
  }

  context.lineWidth = 22;
  context.strokeStyle = WALL_COLOR;
  context.strokeRect(40, 40, VIEWPORT_WIDTH - 80, VIEWPORT_HEIGHT - 80);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255,244,191,0.16)";
  context.strokeRect(52, 52, VIEWPORT_WIDTH - 104, VIEWPORT_HEIGHT - 104);

  drawRoomModifier(context, room, run.elapsed);
  drawDoors(context, room, run);
  drawObstacles(context, room.obstacles);

  if ((room.kind === "boss" || room.kind === "portal") && run.clearedRoomIds.includes(room.id)) {
    drawPortal(context, run.elapsed);
  }
}

function drawDoors(context: CanvasRenderingContext2D, room: RoomDefinition, run: RunState) {
  const open = canUseExit(room, run.clearedRoomIds);

  room.exits.forEach((exit) => {
    const center = getDoorCenter(exit.direction);

    context.save();
    context.translate(center.x, center.y);

    if (exit.direction === "north" || exit.direction === "south") {
      context.fillStyle = open ? "#4d8f7d" : "#6b2630";
      context.fillRect(-54, -10, 108, 20);
    } else {
      context.fillStyle = open ? "#4d8f7d" : "#6b2630";
      context.fillRect(-10, -54, 20, 108);
    }

    context.restore();
  });
}

function drawRoomModifier(
  context: CanvasRenderingContext2D,
  room: RoomDefinition,
  now: number,
) {
  if (room.modifier === "slowField") {
    context.save();
    context.translate(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);
    context.fillStyle = "rgba(96,165,250,0.11)";
    context.strokeStyle = "rgba(147,197,253,0.38)";
    context.lineWidth = 3;
    context.setLineDash([12, 10]);
    context.beginPath();
    context.arc(0, 0, 190 + Math.sin(now * 2) * 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  } else if (room.modifier === "healingWell") {
    context.save();
    context.translate(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);
    context.fillStyle = "rgba(74,222,128,0.14)";
    context.strokeStyle = "rgba(134,239,172,0.55)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 68 + Math.sin(now * 3) * 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  } else if (room.modifier === "barrage") {
    context.fillStyle = "rgba(239,68,68,0.08)";
    context.fillRect(52, 52, VIEWPORT_WIDTH - 104, 42);
  } else if (room.modifier === "eliteBoost") {
    context.strokeStyle = "rgba(217,164,65,0.36)";
    context.lineWidth = 5;
    context.strokeRect(66, 66, VIEWPORT_WIDTH - 132, VIEWPORT_HEIGHT - 132);
  }
}

function drawObstacles(context: CanvasRenderingContext2D, obstacles: Obstacle[]) {
  obstacles.forEach((obstacle) => {
    context.fillStyle = "#2b2530";
    context.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    context.strokeStyle = "#6b5a45";
    context.lineWidth = 3;
    context.strokeRect(obstacle.x + 2, obstacle.y + 2, obstacle.w - 4, obstacle.h - 4);
    context.fillStyle = "rgba(143,211,255,0.08)";
    context.fillRect(obstacle.x + 8, obstacle.y + 7, obstacle.w - 16, 6);
  });
}

function drawPortal(context: CanvasRenderingContext2D, now: number) {
  const pulse = 0.5 + Math.sin(now * 4) * 0.5;

  context.save();
  context.translate(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);
  context.strokeStyle = `rgba(217,164,65,${0.35 + pulse * 0.45})`;
  context.lineWidth = 8;
  context.beginPath();
  context.ellipse(0, 0, 38 + pulse * 7, 22 + pulse * 4, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = `rgba(143,211,255,${0.12 + pulse * 0.18})`;
  context.beginPath();
  context.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawAttackZones(
  context: CanvasRenderingContext2D,
  zones: AttackZone[],
  now: number,
) {
  zones.forEach((zone) => {
    const active = now >= zone.telegraphUntil;

    context.save();

    if (zone.kind === "laserSweep" || zone.kind === "shockwaveLine") {
      const width = active ? zone.width ?? 24 : Math.max(8, (zone.width ?? 24) * 0.42);
      const lengthLimit = zone.length ?? VIEWPORT_WIDTH;

      context.translate(zone.x, zone.y);
      context.rotate(getZoneAngle(zone, now));
      context.fillStyle = active
        ? zone.kind === "laserSweep"
          ? "rgba(244,114,182,0.34)"
          : "rgba(251,146,60,0.34)"
        : "rgba(248,113,113,0.13)";
      context.strokeStyle = active
        ? zone.kind === "laserSweep"
          ? "#f9a8d4"
          : "#fed7aa"
        : "#ef4444";
      context.lineWidth = active ? 3 : 2;
      context.setLineDash(active ? [] : [12, 8]);
      context.fillRect(0, -width / 2, lengthLimit, width);
      context.strokeRect(0, -width / 2, lengthLimit, width);
      context.setLineDash([]);
      context.beginPath();
      context.arc(0, 0, 9, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }

    context.translate(zone.x, zone.y);
    context.beginPath();
    context.arc(0, 0, zone.radius, 0, Math.PI * 2);

    if (zone.kind === "gravityPulse") {
      context.fillStyle = active ? "rgba(96,165,250,0.22)" : "rgba(96,165,250,0.1)";
      context.strokeStyle = active ? "#bfdbfe" : "#60a5fa";
    } else if (zone.kind === "delayedRift") {
      context.fillStyle = active ? "rgba(168,85,247,0.36)" : "rgba(168,85,247,0.13)";
      context.strokeStyle = active ? "#f5d0fe" : "#c084fc";
    } else {
      context.fillStyle = active ? "rgba(239,68,68,0.36)" : "rgba(248,113,113,0.16)";
      context.strokeStyle = active ? "#fecaca" : "#ef4444";
    }

    context.lineWidth = active ? 4 : 3;
    context.setLineDash(active ? [] : [10, 8]);
    context.fill();
    context.stroke();
    context.restore();
  });
}

function drawPickups(context: CanvasRenderingContext2D, pickups: Pickup[], now: number) {
  pickups.forEach((pickup) => {
    const bob = Math.sin(now * 5 + pickup.x) * 4;

    context.save();
    context.translate(pickup.x, pickup.y + bob);
    context.shadowColor = getPickupColor(pickup.type);
    context.shadowBlur = 18;
    context.fillStyle = getPickupColor(pickup.type);
    context.beginPath();
    context.moveTo(0, -18);
    context.lineTo(18, 0);
    context.lineTo(0, 18);
    context.lineTo(-18, 0);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "#fff4bf";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  });
}

function getPickupColor(type: PickupType) {
  if (type === "artifactCache") {
    return "#d9a441";
  }

  if (type === "healingCrystal") {
    return "#45c777";
  }

  if (type === "shieldCrystal") {
    return "#38bdf8";
  }

  return "#a78bfa";
}

function drawProjectiles(context: CanvasRenderingContext2D, projectiles: Projectile[]) {
  projectiles.forEach((projectile) => {
    context.save();
    context.shadowColor = projectile.color;
    context.shadowBlur = 16;
    context.fillStyle = projectile.color;
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(255,255,255,0.55)";
    context.stroke();
    context.restore();
  });
}

function drawEnemies(context: CanvasRenderingContext2D, enemies: EnemyState[], now: number) {
  enemies.forEach((enemy) => {
    switch (enemy.kind) {
      case "afterimageShard":
        drawAfterimageShard(context, enemy, now);
        break;
      case "boss":
        drawBoss(context, enemy, now);
        break;
      case "gravityNode":
        drawGravityNode(context, enemy, now);
        break;
      case "guardian":
        drawGuardian(context, enemy, now);
        break;
      case "regenerationPriest":
        drawRegenerationPriest(context, enemy, now);
        break;
      case "resonanceTurret":
        drawResonanceTurret(context, enemy, now);
        break;
      case "riftApostle":
        drawRiftApostle(context, enemy, now);
        break;
      case "riftMine":
        drawRiftMine(context, enemy, now);
        break;
      case "warpLeaper":
        drawWarpLeaper(context, enemy, now);
        break;
      case "stalker":
        drawStalker(context, enemy, now);
        break;
    }

    drawEnemyHealth(context, enemy);
  });
}

function drawAfterimageShard(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(now * 4 + enemy.x);
  context.fillStyle = "#ef7f8f";
  context.beginPath();
  context.moveTo(0, -16);
  context.lineTo(14, 0);
  context.lineTo(0, 16);
  context.lineTo(-14, 0);
  context.closePath();
  context.fill();
  context.strokeStyle = "#fecaca";
  context.stroke();
  context.restore();
}

function drawResonanceTurret(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y);

  if (enemy.phase === "casting") {
    context.strokeStyle = "rgba(249,226,175,0.7)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(enemy.targetX - enemy.x, enemy.targetY - enemy.y);
    context.stroke();
  }

  context.fillStyle = "#66512a";
  context.fillRect(-20, -20, 40, 40);
  context.fillStyle = "#f9e2af";
  context.beginPath();
  context.arc(0, 0, 10 + Math.sin(now * 8) * 2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2f2414";
  context.lineWidth = 4;
  context.strokeRect(-20, -20, 40, 40);
  context.restore();
}

function drawWarpLeaper(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(Math.sin(now * 7) * 0.14);
  context.fillStyle = "#0f766e";
  context.beginPath();
  context.moveTo(0, -22);
  context.lineTo(20, 18);
  context.lineTo(0, 10);
  context.lineTo(-20, 18);
  context.closePath();
  context.fill();
  context.strokeStyle = enemy.phase === "windup" ? "#99f6e4" : "#2dd4bf";
  context.lineWidth = enemy.phase === "windup" ? 5 : 3;
  context.stroke();
  context.restore();
}

function drawRegenerationPriest(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y + Math.sin(now * 3) * 3);
  context.fillStyle = "#166534";
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(21, 12);
  context.lineTo(0, 25);
  context.lineTo(-21, 12);
  context.closePath();
  context.fill();
  context.strokeStyle = "#86efac";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#dcfce7";
  context.fillRect(-5, -6, 10, 18);
  context.restore();
}

function drawRiftMine(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  const pulse = enemy.phase === "windup" ? 5 + Math.sin(now * 18) * 4 : Math.sin(now * 5) * 2;

  context.save();
  context.translate(enemy.x, enemy.y);
  context.fillStyle = enemy.phase === "windup" ? "#dc2626" : "#7f1d1d";
  context.beginPath();
  context.arc(0, 0, enemy.radius + pulse, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#fecaca";
  context.lineWidth = 3;
  context.stroke();
  context.restore();
}

function drawGravityNode(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.strokeStyle = "rgba(147,197,253,0.42)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 46 + Math.sin(now * 3) * 6, 0, Math.PI * 2);
  context.stroke();
  context.rotate(now);
  context.fillStyle = "#1d4ed8";
  context.fillRect(-18, -18, 36, 36);
  context.fillStyle = "#bfdbfe";
  context.beginPath();
  context.arc(0, 0, 8, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBoss(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  const phase = enemy.boss?.phase ?? 1;

  context.save();
  context.translate(enemy.x, enemy.y);

  if (enemy.phase === "windup") {
    context.strokeStyle = "#f9a8d4";
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, enemy.radius + 18 + Math.sin(now * 14) * 4, 0, Math.PI * 2);
    context.stroke();
  }

  const outline = phase >= 3 ? "#fef2f2" : phase >= 2 ? "#f9a8d4" : "#fca5a5";
  const bossKind = enemy.boss?.kind;

  context.strokeStyle = outline;
  context.lineWidth = 5;

  if (bossKind === "armoredJudicator") {
    context.fillStyle = "#6b4f1d";
    context.fillRect(-36, -34, 72, 68);
    context.strokeRect(-36, -34, 72, 68);
    context.fillStyle = "#facc15";
    context.fillRect(-44, -18, 88, 36);
    context.strokeRect(-44, -18, 88, 36);
    context.fillStyle = "#1f2937";
    context.fillRect(-12, -8, 24, 16);
  } else if (bossKind === "resonanceHierophant") {
    context.fillStyle = "#581c87";
    context.beginPath();
    context.moveTo(0, -48);
    context.lineTo(42, 26);
    context.lineTo(0, 48);
    context.lineTo(-42, 26);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#e9d5ff";
    context.beginPath();
    context.arc(0, -6, 14, 0, Math.PI * 2);
    context.fill();
  } else if (bossKind === "echoSplinterCore") {
    context.rotate(Math.sin(now * 2.8) * 0.16);
    context.fillStyle = "#701a75";
    context.beginPath();
    context.moveTo(0, -42);
    context.lineTo(34, 0);
    context.lineTo(0, 42);
    context.lineTo(-34, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#f0abfc";
    context.fillRect(-9, -9, 18, 18);
    context.globalAlpha = 0.65;
    context.fillStyle = "#a78bfa";
    context.beginPath();
    context.arc(-45, 16, 13, 0, Math.PI * 2);
    context.arc(45, 16, 13, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  } else if (bossKind === "gravityObserver") {
    context.strokeStyle = "#bfdbfe";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 55 + Math.sin(now * 3) * 5, 0, Math.PI * 2);
    context.stroke();
    context.rotate(now * 0.55);
    context.fillStyle = "#1e3a8a";
    context.fillRect(-34, -34, 68, 68);
    context.strokeStyle = outline;
    context.lineWidth = 5;
    context.strokeRect(-34, -34, 68, 68);
    context.fillStyle = "#dbeafe";
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
  } else if (bossKind === "waveCrusher") {
    context.fillStyle = "#134e4a";
    context.beginPath();
    context.moveTo(0, -48);
    context.lineTo(48, -12);
    context.lineTo(28, 42);
    context.lineTo(-28, 42);
    context.lineTo(-48, -12);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#67e8f9";
    context.fillRect(-54, -4, 108, 11);
    context.fillStyle = "#fb7185";
    context.fillRect(-12, -20, 24, 40);
  } else if (bossKind === "deepTuner") {
    context.fillStyle = "#312e81";
    context.beginPath();
    context.moveTo(0, -54);
    context.lineTo(46, -18);
    context.lineTo(34, 38);
    context.lineTo(0, 54);
    context.lineTo(-34, 38);
    context.lineTo(-46, -18);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = "#fde68a";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 34 + Math.sin(now * 5) * 3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#fef3c7";
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = "#7f1d1d";
    context.beginPath();
    context.moveTo(0, -48);
    context.lineTo(42, -10);
    context.lineTo(28, 42);
    context.lineTo(-28, 42);
    context.lineTo(-42, -10);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#fecaca";
    context.fillRect(-15, -12, 10, 10);
    context.fillRect(5, -12, 10, 10);
  }

  context.restore();
}

function drawStalker(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  const windup = enemy.phase === "windup";
  const lunge = enemy.phase === "lunging";

  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(Math.sin(now * 8 + enemy.x) * 0.08);

  if (windup || lunge) {
    context.strokeStyle = windup ? "#fb7185" : "#fecaca";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, enemy.radius + 9, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#7f1d1d";
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(24, -4);
  context.lineTo(12, 21);
  context.lineTo(-12, 21);
  context.lineTo(-24, -4);
  context.closePath();
  context.fill();
  context.fillStyle = "#fecaca";
  context.fillRect(-7, -7, 5, 5);
  context.fillRect(2, -7, 5, 5);
  context.strokeStyle = "#ffb4a6";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-20, 10);
  context.lineTo(-34, 20);
  context.moveTo(20, 10);
  context.lineTo(34, 20);
  context.stroke();
  context.restore();
}

function drawGuardian(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  context.save();
  context.translate(enemy.x, enemy.y);

  if (enemy.phase === "windup") {
    context.strokeStyle = "#facc15";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, 38 + Math.sin(now * 16) * 3, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#7a5d24";
  context.fillRect(-22, -24, 44, 48);
  context.fillStyle = "#d9a441";
  context.fillRect(-27, -16, 54, 32);
  context.fillStyle = "#fff4bf";
  context.fillRect(-9, -6, 18, 12);
  context.strokeStyle = "#3d2d14";
  context.lineWidth = 5;
  context.strokeRect(-27, -16, 54, 32);
  context.restore();
}

function drawRiftApostle(context: CanvasRenderingContext2D, enemy: EnemyState, now: number) {
  const cast = enemy.phase === "casting";

  context.save();
  context.translate(enemy.x, enemy.y + Math.sin(now * 4 + enemy.x) * 4);

  if (cast) {
    context.strokeStyle = "#d8b4fe";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 34, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#4c1d95";
  context.beginPath();
  context.moveTo(0, -26);
  context.lineTo(24, 16);
  context.lineTo(0, 27);
  context.lineTo(-24, 16);
  context.closePath();
  context.fill();
  context.fillStyle = "#e9d5ff";
  context.beginPath();
  context.arc(0, -3, 8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#111827";
  context.beginPath();
  context.arc(0, -3, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEnemyHealth(context: CanvasRenderingContext2D, enemy: EnemyState) {
  const width = enemy.radius * 2.2;
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);

  context.fillStyle = "rgba(0,0,0,0.65)";
  context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 16, width, 5);
  context.fillStyle = "#ef4444";
  context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 16, width * ratio, 5);
}

function drawPlayer(context: CanvasRenderingContext2D, player: PlayerState, now: number) {
  const dashing = now < player.dashUntil;
  const hurtFlash = now < player.invulnerableUntil && Math.floor(now * 18) % 2 === 0;

  context.save();
  context.translate(player.x, player.y);

  if (dashing) {
    context.strokeStyle = "rgba(143,211,255,0.7)";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-player.dashVx * 0.045, -player.dashVy * 0.045);
    context.lineTo(0, 0);
    context.stroke();
  }

  context.shadowColor = "#8fd3ff";
  context.shadowBlur = dashing ? 24 : 12;
  context.fillStyle = hurtFlash ? "#ffffff" : "#a7f3ff";
  context.beginPath();
  context.moveTo(0, -22);
  context.lineTo(18, -2);
  context.lineTo(10, 20);
  context.lineTo(-10, 20);
  context.lineTo(-18, -2);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#0e7490";
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = "#fff4bf";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(13, -8);
  context.lineTo(31, -27);
  if (player.evolution === "dualBladeAssault") {
    context.moveTo(-13, -8);
    context.lineTo(-31, -27);
  }
  context.stroke();
  context.restore();
}

function drawFloatingTexts(context: CanvasRenderingContext2D, texts: FloatingText[]) {
  context.save();
  context.textAlign = "center";
  context.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";

  texts.forEach((text) => {
    context.globalAlpha = Math.min(1, text.ttl * 1.7);
    context.fillStyle = text.color;
    context.fillText(text.text, text.x, text.y);
  });

  context.restore();
}

function drawVignette(context: CanvasRenderingContext2D) {
  const gradient = context.createRadialGradient(
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    120,
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    580,
  );

  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.48)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
}
