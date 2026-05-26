import { STAGES } from "./levels";
import type {
  Bomb,
  BossHazard,
  BossPattern,
  BossTier,
  BonusKind,
  CrystalCrate,
  Enemy,
  EnemyDefinition,
  EnemyProjectile,
  Explosion,
  InputState,
  Particle,
  Pickup,
  Platform,
  Rect,
  RiftPad,
  RunSnapshot,
  RunState,
  StageDefinition,
  Vec2,
} from "./types";

export const VIEWPORT_WIDTH = 320;
export const VIEWPORT_HEIGHT = 224;

const PLAYER_WIDTH = 12;
const PLAYER_HEIGHT = 18;
const GRAVITY = 520;
const JUMP_SPEED = 176;
const BASE_PLAYER_SPEED = 78;
const BOMB_SPEED_X = 106;
const BOMB_SPEED_Y = -134;
const BOMB_FUSE_SECONDS = 0.9;
const BASE_BOMB_COOLDOWN = 0.56;
const BASE_BOMB_RANGE = 27;
const MAX_DELTA_SECONDS = 1 / 30;
let nextId = 0;

export function createInputState(): InputState {
  return {
    bomb: false,
    bombQueued: false,
    jump: false,
    jumpQueued: false,
    left: false,
    right: false,
    startQueued: false,
    up: false,
    use: false,
    useQueued: false,
  };
}

export function createRunState(phase: RunState["phase"] = "title"): RunState {
  return createStageState(0, 3, 0, phase);
}

export function createRunSnapshot(run: RunState): RunSnapshot {
  const stage = getStage(run);
  const boss = run.enemies.find((enemy) => enemy.kind === "boss");
  const keyStatus = run.player.carryingKey
    ? "수정 운반"
    : run.key.available
      ? "수정 대기"
      : "괴수 정리";

  return {
    bossHealthRatio: boss ? Math.max(0, boss.hp / boss.maxHp) : 0,
    bossName: boss?.displayName ?? "",
    bossTier: boss?.bossTier ?? 0,
    bossWave: boss ? `${run.bossIndex}/${stage.bosses.length}` : "",
    bombReady: run.player.bombCooldown <= 0 && !run.player.carryingKey,
    keyStatus,
    lives: run.lives,
    message: run.message,
    phase: run.phase,
    score: run.score,
    shieldActive: run.player.shieldTimer > 0 || run.player.invincibleTimer > 0,
    stageId: stage.id,
    stageName: stage.name,
  };
}

export function stepRun(run: RunState, input: InputState, deltaSeconds: number): void {
  const dt = Math.min(deltaSeconds, MAX_DELTA_SECONDS);
  run.elapsed += dt;
  updateParticles(run.particles, dt);
  updateExplosions(run.explosions, dt);

  if (run.phase === "title") {
    run.message = "Space 또는 J로 시작";
    if (input.startQueued || input.bombQueued || input.jumpQueued) {
      run.phase = "playing";
      run.message = "사이오닉 폭탄 장전";
    }
    consumeQueuedInput(input);
    return;
  }

  if (run.phase === "stageClear") {
    run.phaseTimer -= dt;
    if (run.phaseTimer <= 0) {
      advanceStage(run);
    }
    consumeQueuedInput(input);
    return;
  }

  if (run.phase === "gameover" || run.phase === "victory") {
    consumeQueuedInput(input);
    return;
  }

  updatePlayerTimers(run.player, dt);
  handlePlayerInput(run, input, dt);
  movePlayer(run, dt);
  handlePlayerRift(run, input);
  updateBombs(run, dt);
  updateEnemies(run, dt);
  updateProjectiles(run, dt);
  updateHazards(run, dt);
  collectPickups(run, dt);
  handleKeyAndPortal(run, input);
  maybeOpenKeyRun(run);
  consumeQueuedInput(input);
}

function createStageState(
  stageIndex: number,
  lives: number,
  score: number,
  phase: RunState["phase"],
): RunState {
  const stage = STAGES[stageIndex];

  return {
    bossIndex: 0,
    bombs: [],
    crates: stage.crates.map((crate) => ({ ...crate, hp: 1 })),
    elapsed: 0,
    enemies: stage.enemies.map(createEnemy),
    explosions: [],
    hazards: [],
    key: { available: false, pos: { ...stage.keySpawn } },
    lives,
    message: phase === "title" ? "Space 또는 J로 시작" : "괴수를 모두 정리하세요",
    particles: [],
    phase,
    phaseTimer: 0,
    pickups: [],
    player: createPlayer(stage.start),
    projectiles: [],
    score,
    stageIndex,
    stageMode: "combat",
  };
}

function createPlayer(start: Vec2) {
  return {
    bombCooldown: 0,
    bombCooldownScale: 1,
    bombRange: BASE_BOMB_RANGE,
    carryingKey: false,
    facing: 1 as const,
    height: PLAYER_HEIGHT,
    invincibleTimer: 1.1,
    onGround: false,
    padCooldown: 0,
    pos: { ...start },
    shieldTimer: 0,
    speedBoostTimer: 0,
    velocity: { x: 0, y: 0 },
    width: PLAYER_WIDTH,
  };
}

function createEnemy(definition: EnemyDefinition): Enemy {
  const bossTier = definition.bossTier ?? 1;
  const threat = definition.threat ?? 1;
  const stageRank = Math.round(
    clamp(definition.stageId ?? threat - (bossTier - 1) * 1.5, 1, STAGES.length),
  );
  const stageProgress = getStageProgress(stageRank);
  const stats = getEnemyStats(definition.kind, bossTier, threat, stageRank);

  return {
    bossPattern: "fan",
    bossTier,
    contactCooldown: 0,
    dashTimer: 0,
    direction: definition.x > (definition.minX + definition.maxX) / 2 ? -1 : 1,
    displayName: definition.name ?? getFallbackEnemyName(definition.kind, bossTier),
    fireCooldown:
      definition.kind === "boss"
        ? Math.max(0.72, 1.48 - stageProgress * 0.42 - (bossTier - 1) * 0.08 - threat * 0.018)
        : definition.kind === "caster"
          ? 0.7
          : 1.8,
    height: stats.height,
    hitFlash: 0,
    hp: stats.hp,
    id: definition.id,
    kind: definition.kind,
    maxHp: stats.hp,
    maxX: definition.maxX,
    minX: definition.minX,
    onGround: false,
    patternCooldown:
      definition.kind === "boss"
        ? Math.max(0.92, 2.12 - stageProgress * 0.64 - (bossTier - 1) * 0.14 - threat * 0.026)
        : 0,
    patternIndex: 0,
    pos: { x: definition.x, y: definition.y },
    stageRank,
    summonCooldown: definition.kind === "boss" ? 3.3 : 0,
    threat,
    velocity: { x: 0, y: 0 },
    width: stats.width,
  };
}

function getEnemyStats(kind: Enemy["kind"], bossTier: BossTier, threat: number, stageRank: number) {
  switch (kind) {
    case "boss":
      {
        const stageProgress = getStageProgress(stageRank);

        return {
          height: 28 + bossTier * 4,
          hp: Math.round(
            10 + bossTier * 5 + threat * 1.4 + stageProgress * 8 + (bossTier === 3 ? stageProgress * 6 : 0),
          ),
          width: 28 + bossTier * 5,
        };
      }
    case "caster":
      return {
        height: 16,
        hp: 1,
        width: 13,
      };
    case "charger":
      return { height: 15, hp: 2, width: 15 };
    case "patrol":
    default:
      return { height: 13, hp: 1, width: 13 };
  }
}

function getFallbackEnemyName(kind: Enemy["kind"], bossTier: BossTier): string {
  if (kind === "boss") {
    return bossTier === 3 ? "최종 차원 군주" : `차원 보스 ${bossTier}`;
  }

  return kind;
}

function getStage(run: RunState): StageDefinition {
  return STAGES[run.stageIndex];
}

function handlePlayerInput(run: RunState, input: InputState, dt: number): void {
  const player = run.player;
  const direction = Number(input.right) - Number(input.left);
  const speed = BASE_PLAYER_SPEED + (player.speedBoostTimer > 0 ? 22 : 0);

  player.velocity.x = direction * speed;

  if (direction !== 0) {
    player.facing = direction > 0 ? 1 : -1;
  }

  if (input.jumpQueued && player.onGround) {
    player.velocity.y = -JUMP_SPEED;
    player.onGround = false;
    run.particles.push(...createBurst(player.pos, "#67e8f9", 10, 46));
  }

  if (
    input.bombQueued &&
    !player.carryingKey &&
    player.bombCooldown <= 0 &&
    run.bombs.length < 3
  ) {
    run.bombs.push({
      fuse: BOMB_FUSE_SECONDS,
      id: makeId("bomb"),
      padCooldown: 0,
      pos: { x: player.pos.x + player.facing * 9, y: player.pos.y - 5 },
      radius: 4,
      range: player.bombRange,
      velocity: {
        x: player.facing * BOMB_SPEED_X,
        y: BOMB_SPEED_Y,
      },
    });
    player.bombCooldown = BASE_BOMB_COOLDOWN * player.bombCooldownScale;
  }

  if (player.bombCooldown > 0) {
    player.bombCooldown = Math.max(0, player.bombCooldown - dt);
  }
}

function movePlayer(run: RunState, dt: number): void {
  const player = run.player;
  const previous = { ...player.pos };
  player.velocity.y += GRAVITY * dt;
  player.pos.x += player.velocity.x * dt;
  resolveActorCollisions(player, previous, getStage(run).platforms);
  player.pos.y += player.velocity.y * dt;
  player.onGround = false;
  resolveActorCollisions(player, previous, getStage(run).platforms);
  clampPlayer(player);
}

function resolveActorCollisions(
  actor: {
    height: number;
    onGround: boolean;
    pos: Vec2;
    velocity: Vec2;
    width: number;
  },
  previous: Vec2,
  platforms: Platform[],
): void {
  const rect = actorRect(actor);

  for (const platform of platforms) {
    if (!rectsOverlap(rect, platform)) {
      continue;
    }

    const previousRect = {
      height: actor.height,
      width: actor.width,
      x: previous.x - actor.width / 2,
      y: previous.y - actor.height / 2,
    };

    const platformBottom = platform.y + platform.height;
    const previousBottom = previousRect.y + previousRect.height;
    const previousTop = previousRect.y;
    const previousRight = previousRect.x + previousRect.width;
    const previousLeft = previousRect.x;

    if (previousBottom <= platform.y + 2 && actor.velocity.y >= 0) {
      actor.pos.y = platform.y - actor.height / 2;
      actor.velocity.y = 0;
      actor.onGround = true;
    } else if (previousTop >= platformBottom - 2 && actor.velocity.y < 0) {
      actor.pos.y = platformBottom + actor.height / 2;
      actor.velocity.y = Math.max(0, actor.velocity.y);
    } else if (previousRight <= platform.x && actor.velocity.x > 0) {
      actor.pos.x = platform.x - actor.width / 2;
      actor.velocity.x = 0;
    } else if (previousLeft >= platform.x + platform.width && actor.velocity.x < 0) {
      actor.pos.x = platform.x + platform.width + actor.width / 2;
      actor.velocity.x = 0;
    }
  }
}

function clampPlayer(player: RunState["player"]): void {
  const halfWidth = player.width / 2;

  player.pos.x = clamp(player.pos.x, halfWidth, VIEWPORT_WIDTH - halfWidth);

  if (player.pos.y > VIEWPORT_HEIGHT + 18) {
    player.pos.y = VIEWPORT_HEIGHT + 18;
  }
}

function handlePlayerRift(run: RunState, input: InputState): void {
  const player = run.player;

  if (player.padCooldown > 0) {
    return;
  }

  if (!input.up && !input.jumpQueued && !input.useQueued) {
    return;
  }

  const activePad = getStage(run).pads.find((pad) => rectsOverlap(actorRect(player), pad));

  if (!activePad) {
    return;
  }

  const target = findPairedPad(getStage(run).pads, activePad);

  if (!target) {
    return;
  }

  player.pos.x = target.x + target.width / 2;
  player.pos.y = target.y - player.height / 2 - 3;
  player.velocity.y = -68;
  player.padCooldown = 0.42;
  run.particles.push(...createBurst(player.pos, "#22d3ee", 22, 78));
}

function updateBombs(run: RunState, dt: number): void {
  const stage = getStage(run);
  const remaining: Bomb[] = [];

  for (const bomb of run.bombs) {
    bomb.fuse -= dt;
    bomb.padCooldown = Math.max(0, bomb.padCooldown - dt);
    bomb.velocity.y += GRAVITY * dt * 0.82;
    bomb.pos.x += bomb.velocity.x * dt;
    bounceBombFromWalls(bomb);
    resolveBombPlatforms(bomb, stage.platforms);
    bomb.pos.y += bomb.velocity.y * dt;
    resolveBombPlatforms(bomb, stage.platforms);
    handleBombRift(bomb, stage.pads);

    if (bomb.fuse <= 0) {
      detonateBomb(run, bomb);
    } else {
      remaining.push(bomb);
    }
  }

  run.bombs = remaining;
}

function bounceBombFromWalls(bomb: Bomb): void {
  if (bomb.pos.x < bomb.radius) {
    bomb.pos.x = bomb.radius;
    bomb.velocity.x = Math.abs(bomb.velocity.x) * 0.62;
  } else if (bomb.pos.x > VIEWPORT_WIDTH - bomb.radius) {
    bomb.pos.x = VIEWPORT_WIDTH - bomb.radius;
    bomb.velocity.x = -Math.abs(bomb.velocity.x) * 0.62;
  }
}

function resolveBombPlatforms(bomb: Bomb, platforms: Platform[]): void {
  for (const platform of platforms) {
    if (!circleRectOverlap(bomb.pos, bomb.radius, platform)) {
      continue;
    }

    const centerX = platform.x + platform.width / 2;
    const centerY = platform.y + platform.height / 2;
    const overlapX = platform.width / 2 + bomb.radius - Math.abs(bomb.pos.x - centerX);
    const overlapY = platform.height / 2 + bomb.radius - Math.abs(bomb.pos.y - centerY);

    if (overlapY <= overlapX) {
      if (bomb.pos.y < centerY) {
        bomb.pos.y = platform.y - bomb.radius;
        bomb.velocity.y = -Math.abs(bomb.velocity.y) * 0.38;
      } else {
        bomb.pos.y = platform.y + platform.height + bomb.radius;
        bomb.velocity.y = Math.abs(bomb.velocity.y) * 0.22;
      }
    } else if (bomb.pos.x < centerX) {
      bomb.pos.x = platform.x - bomb.radius;
      bomb.velocity.x = -Math.abs(bomb.velocity.x) * 0.56;
    } else {
      bomb.pos.x = platform.x + platform.width + bomb.radius;
      bomb.velocity.x = Math.abs(bomb.velocity.x) * 0.56;
    }
  }
}

function handleBombRift(bomb: Bomb, pads: RiftPad[]): void {
  if (bomb.padCooldown > 0) {
    return;
  }

  const activePad = pads.find((pad) => circleRectOverlap(bomb.pos, bomb.radius, pad));
  const target = activePad ? findPairedPad(pads, activePad) : undefined;

  if (!target) {
    return;
  }

  bomb.pos.x = target.x + target.width / 2;
  bomb.pos.y = target.y - bomb.radius - 4;
  bomb.velocity.y = -130;
  bomb.velocity.x *= 0.85;
  bomb.padCooldown = 0.36;
}

function detonateBomb(run: RunState, bomb: Bomb): void {
  run.explosions.push({ life: 0.22, pos: { ...bomb.pos }, radius: bomb.range, ttl: 0.22 });
  run.particles.push(...createBurst(bomb.pos, "#facc15", 38, 120));

  if (distance(bomb.pos, run.player.pos) <= bomb.range + 5) {
    damagePlayer(run, "사이오닉 폭발에 휘말렸습니다");
  }

  const survivingEnemies: Enemy[] = [];

  for (const enemy of run.enemies) {
    if (distance(bomb.pos, enemy.pos) <= bomb.range + enemy.width / 2) {
      enemy.hp -= enemy.kind === "boss" ? 2 : 1;
      enemy.hitFlash = 0.16;
      run.score += enemy.kind === "boss" ? 120 : 90;
      run.particles.push(...createBurst(enemy.pos, "#e879f9", 14, 70));
    }

    if (enemy.hp > 0) {
      survivingEnemies.push(enemy);
    } else {
      run.score += enemy.kind === "boss" ? 1300 : 240;
      run.particles.push(...createBurst(enemy.pos, "#a78bfa", 24, 96));
    }
  }

  run.enemies = survivingEnemies;

  const remainingCrates: CrystalCrate[] = [];

  for (const crate of run.crates) {
    if (circleRectOverlap(bomb.pos, bomb.range, crate)) {
      spawnPickup(run, crate);
      run.score += 80;
      run.particles.push(
        ...createBurst(
          { x: crate.x + crate.width / 2, y: crate.y + crate.height / 2 },
          "#67e8f9",
          18,
          88,
        ),
      );
    } else {
      remainingCrates.push(crate);
    }
  }

  run.crates = remainingCrates;
}

function updateEnemies(run: RunState, dt: number): void {
  const stage = getStage(run);

  for (const enemy of run.enemies) {
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.patternCooldown = Math.max(0, enemy.patternCooldown - dt);
    enemy.summonCooldown = Math.max(0, enemy.summonCooldown - dt);
    enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);

    updateEnemyVelocity(enemy, run, dt);

    const previous = { ...enemy.pos };
    enemy.velocity.y += GRAVITY * dt;
    enemy.pos.x += enemy.velocity.x * dt;

    if (enemy.pos.x < enemy.minX || enemy.pos.x > enemy.maxX) {
      enemy.direction = enemy.pos.x < enemy.minX ? 1 : -1;
      enemy.pos.x = clamp(enemy.pos.x, enemy.minX, enemy.maxX);
    }

    resolveActorCollisions(enemy, previous, stage.platforms);
    enemy.pos.y += enemy.velocity.y * dt;
    enemy.onGround = false;
    resolveActorCollisions(enemy, previous, stage.platforms);

    if (enemy.kind === "caster" && enemy.fireCooldown <= 0) {
      fireEnemyProjectile(run, enemy, 74);
      enemy.fireCooldown = 1.45;
    } else if (enemy.kind === "boss") {
      updateBoss(run, enemy, dt);
    }

    if (rectsOverlap(actorRect(run.player), actorRect(enemy)) && enemy.contactCooldown <= 0) {
      enemy.contactCooldown = 0.7;
      damagePlayer(run, "괴수에게 밀려났습니다");
    }
  }
}

function updateEnemyVelocity(enemy: Enemy, run: RunState, dt: number): void {
  const dx = run.player.pos.x - enemy.pos.x;

  switch (enemy.kind) {
    case "charger":
      enemy.velocity.x = Math.sign(dx || enemy.direction) * (Math.abs(dx) < 105 ? 46 : 28);
      enemy.direction = enemy.velocity.x >= 0 ? 1 : -1;
      break;
    case "caster":
      if (Math.abs(dx) < 46) {
        enemy.velocity.x = -Math.sign(dx || enemy.direction) * 26;
      } else {
        enemy.velocity.x = enemy.direction * 18;
      }
      if (enemy.pos.x <= enemy.minX + 2 || enemy.pos.x >= enemy.maxX - 2) {
        enemy.direction *= -1;
      }
      break;
    case "boss":
      if (enemy.dashTimer > 0) {
        enemy.velocity.x =
          enemy.direction * (enemy.hp < enemy.maxHp * 0.45 ? 126 : 104) * getBossIntensity(enemy);
      } else {
        enemy.velocity.x =
          Math.sign(dx || enemy.direction) *
          (enemy.hp < enemy.maxHp * 0.45 ? 36 : 28) *
          getBossIntensity(enemy);
      }
      enemy.direction = enemy.velocity.x >= 0 ? 1 : -1;
      break;
    case "patrol":
    default:
      enemy.velocity.x = enemy.direction * 24;
      if (enemy.pos.x <= enemy.minX + 2 || enemy.pos.x >= enemy.maxX - 2) {
        enemy.direction *= -1;
      }
      break;
  }

  enemy.velocity.x *= Math.exp(-0.02 * dt);
}

function updateBoss(run: RunState, boss: Enemy, dt: number): void {
  const intensity = getBossIntensity(boss);
  const stageProgress = getBossStageProgress(boss);
  const enraged = boss.hp < boss.maxHp * 0.45;

  if (boss.fireCooldown <= 0) {
    fireEnemyProjectile(run, boss, (enraged ? 94 : 78) * intensity, "bolt");
    boss.fireCooldown = Math.max(
      0.72 - stageProgress * 0.28 - (boss.bossTier - 1) * 0.03,
      (enraged ? 1.0 : 1.34) / intensity,
    );
  }

  if (boss.patternCooldown > 0) {
    return;
  }

  const patterns = getBossPatternSequence(boss);
  const pattern = patterns[boss.patternIndex % patterns.length];
  boss.bossPattern = pattern;
  boss.patternIndex += 1;
  boss.patternCooldown = Math.max(
    1.08 - stageProgress * 0.36 - (boss.bossTier - 1) * 0.03,
    (enraged ? 1.72 : 2.25) / intensity,
  );

  if (pattern === "fan") {
    fireFanProjectiles(run, boss);
    run.message = `${boss.displayName}: 분광 탄막`;
  } else if (pattern === "rift") {
    createRiftHazards(run, boss);
    run.message = `${boss.displayName}: 균열 장판`;
  } else if (pattern === "dash") {
    boss.direction = run.player.pos.x >= boss.pos.x ? 1 : -1;
    boss.dashTimer = 0.5 + boss.bossTier * 0.07;
    boss.patternCooldown += 0.25;
    run.hazards.push(createPillarHazard(boss.pos.x + boss.direction * 44, boss.pos.y + 12));
    run.message = `${boss.displayName}: 돌진 예고`;
  } else if (pattern === "summon") {
    summonBossAdds(run, boss);
    run.message = `${boss.displayName}: 괴수 소환`;
  } else if (pattern === "crossfire") {
    createCrossfire(run, boss);
    run.message = `${boss.displayName}: 교차 광선`;
  } else if (pattern === "meteor") {
    createMeteorStrike(run, boss);
    run.message = `${boss.displayName}: 궤도 낙뢰`;
  } else {
    createNovaHazards(run, boss, dt);
    run.message = `${boss.displayName}: 사이오닉 노바`;
  }
}

function getBossPatternSequence(boss: Enemy): BossPattern[] {
  if (boss.stageRank <= 2) {
    if (boss.bossTier === 1) {
      return ["fan"];
    }

    if (boss.bossTier === 2) {
      return ["fan", "dash"];
    }

    return ["fan", "dash", "nova"];
  }

  if (boss.stageRank <= 4) {
    if (boss.bossTier === 1) {
      return ["fan", "dash"];
    }

    if (boss.bossTier === 2) {
      return ["fan", "rift", "dash"];
    }

    return ["fan", "rift", "nova", "summon"];
  }

  if (boss.stageRank <= 6) {
    if (boss.bossTier === 1) {
      return ["fan", "rift"];
    }

    if (boss.bossTier === 2) {
      return ["fan", "rift", "summon", "nova"];
    }

    return ["fan", "rift", "crossfire", "summon", "nova"];
  }

  if (boss.stageRank <= 8) {
    if (boss.bossTier === 1) {
      return ["fan", "rift", "dash"];
    }

    if (boss.bossTier === 2) {
      return ["fan", "rift", "summon", "crossfire", "nova"];
    }

    return ["crossfire", "meteor", "fan", "rift", "summon", "nova"];
  }

  if (boss.bossTier === 1) {
    return ["fan", "rift", "dash", "nova"];
  }

  if (boss.bossTier === 2) {
    return ["fan", "rift", "summon", "crossfire", "nova"];
  }

  return ["crossfire", "meteor", "fan", "rift", "dash", "summon", "nova"];
}

function fireEnemyProjectile(
  run: RunState,
  enemy: Enemy,
  speed: number,
  kind: EnemyProjectile["kind"] = "bolt",
  angleOffset = 0,
): void {
  const toPlayer = normalize({
    x: run.player.pos.x - enemy.pos.x,
    y: run.player.pos.y - enemy.pos.y,
  });
  const velocity = rotateVector(toPlayer, angleOffset);

  run.projectiles.push({
    color: kind === "needle" ? "#f0abfc" : kind === "orb" ? "#fb7185" : "#67e8f9",
    id: makeId("shot"),
    kind,
    pos: { x: enemy.pos.x, y: enemy.pos.y - enemy.height * 0.15 },
    radius: kind === "orb" ? 5 : enemy.kind === "boss" ? 4 : 3,
    ttl: kind === "needle" ? 2.7 : 3.5,
    velocity: { x: velocity.x * speed, y: velocity.y * speed },
  });
}

function fireFanProjectiles(run: RunState, boss: Enemy): void {
  const enraged = boss.hp < boss.maxHp * 0.45;
  const intensity = getBossIntensity(boss);
  const stageProgress = getBossStageProgress(boss);
  const count =
    3 +
    boss.bossTier +
    Math.floor(stageProgress * 3) +
    (enraged ? 1 + Math.floor(stageProgress * 2) : 0);
  const spread = 0.5 + boss.bossTier * 0.07 + stageProgress * 0.42 + (enraged ? 0.18 : 0);
  const speed = (enraged ? 86 : 72) * intensity;

  for (let index = 0; index < count; index += 1) {
    const offset = -spread / 2 + (spread * index) / Math.max(1, count - 1);
    fireEnemyProjectile(run, boss, speed, "needle", offset);
  }
}

function createCrossfire(run: RunState, boss: Enemy): void {
  const stageProgress = getBossStageProgress(boss);
  const laneCount = Math.min(4, 2 + Math.floor(stageProgress * 2) + (boss.bossTier === 3 ? 1 : 0));
  const laneGap = 44;
  const startX = 160 - ((laneCount - 1) * laneGap) / 2;

  for (let index = 0; index < laneCount; index += 1) {
    run.hazards.push({
      damageWindow: 0.42,
      height: 158,
      id: makeId("cross-rift"),
      kind: "rift",
      pos: { x: startX + index * laneGap, y: 121 },
      radius: 0,
      telegraph: 0.72 - stageProgress * 0.18,
      ttl: 1.0,
      width: boss.bossTier === 3 && stageProgress > 0.65 ? 14 : 11,
    });
  }

  const sideShots = 2 + Math.floor(stageProgress * 3) + (boss.bossTier === 3 && stageProgress > 0.65 ? 1 : 0);

  for (let index = 0; index < sideShots; index += 1) {
    const y = 62 + index * 24;
    const speed = 76 + stageProgress * 32;
    fireProjectileFromPoint(run, { x: 8, y }, { x: VIEWPORT_WIDTH - 8, y: y + 12 }, speed, "orb");
    fireProjectileFromPoint(run, { x: VIEWPORT_WIDTH - 8, y: y + 10 }, { x: 8, y }, speed, "orb");
  }
}

function createMeteorStrike(run: RunState, boss: Enemy): void {
  const stageProgress = getBossStageProgress(boss);
  const count = 2 + Math.floor(stageProgress * 3) + (boss.bossTier === 3 ? 1 : 0);
  const base = run.player.pos.x;

  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 34;
    const wobble = Math.sin(run.elapsed * 7 + index * 1.9) * 18;
    run.hazards.push({
      damageWindow: 0.38,
      height: 52,
      id: makeId("meteor"),
      kind: "pillar",
      pos: { x: clamp(base + offset + wobble, 20, VIEWPORT_WIDTH - 20), y: 138 },
      radius: boss.bossTier === 3 && stageProgress > 0.6 ? 22 : 18,
      telegraph: 0.76 - stageProgress * 0.28,
      ttl: 0.98,
      width: 32,
    });
  }
}

function createRiftHazards(run: RunState, boss: Enemy): void {
  const stageProgress = getBossStageProgress(boss);
  const targets = [run.player.pos.x];

  if (boss.bossTier >= 2 || stageProgress > 0.35) {
    targets.push(boss.pos.x - 44, boss.pos.x + 44);
  }

  if (stageProgress > 0.45) {
    targets.push(160);
  }

  if (boss.bossTier === 3 && stageProgress > 0.75) {
    targets.push(58, 262);
  }

  for (const x of targets) {
    if (x < 0) {
      continue;
    }
    run.hazards.push({
      damageWindow: 0.38,
      height: 128,
      id: makeId("rift"),
      kind: "rift",
      pos: { x: clamp(x, 22, VIEWPORT_WIDTH - 22), y: 126 },
      radius: 0,
      telegraph: 0.82 - stageProgress * 0.2,
      ttl: 1.05,
      width: boss.bossTier === 3 && stageProgress > 0.6 ? 15 : 11,
    });
  }
}

function createPillarHazard(x: number, y: number): BossHazard {
  return {
    damageWindow: 0.32,
    height: 46,
    id: makeId("pillar"),
    kind: "pillar",
    pos: { x: clamp(x, 22, VIEWPORT_WIDTH - 22), y },
    radius: 18,
    telegraph: 0.42,
    ttl: 0.76,
    width: 30,
  };
}

function createNovaHazards(run: RunState, boss: Enemy, dt: number): void {
  const enraged = boss.hp < boss.maxHp * 0.45;
  const stageProgress = getBossStageProgress(boss);
  const ringCount =
    1 +
    (boss.bossTier === 3 ? 1 : 0) +
    Math.floor(stageProgress * 2) +
    (enraged ? 1 : 0);

  for (let index = 0; index < ringCount; index += 1) {
    const radius = 30 + index * (22 - stageProgress * 4);
    run.hazards.push({
      damageWindow: 0.34 + dt,
      height: 0,
      id: makeId("nova"),
      kind: "shockwave",
      pos: { ...boss.pos },
      radius,
      telegraph: 0.68 - stageProgress * 0.18 + radius * 0.003,
      ttl: 0.88 + radius * 0.004,
      width: 10,
    });
  }
}

function summonBossAdds(run: RunState, boss: Enemy): void {
  const existingAdds = run.enemies.filter((enemy) => enemy.id.startsWith("spawn")).length;
  const stageProgress = getBossStageProgress(boss);
  const maxAdds = Math.min(
    6,
    1 + Math.floor(stageProgress * 3) + (boss.bossTier - 1) + (boss.hp < boss.maxHp * 0.45 ? 1 : 0),
  );

  if (existingAdds >= maxAdds) {
    fireFanProjectiles(run, boss);
    return;
  }

  const spawnCount = Math.min(
    1 + Math.floor(stageProgress * 2) + (boss.bossTier === 3 ? 1 : 0),
    maxAdds - existingAdds,
  );

  for (let index = 0; index < spawnCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = clamp(boss.pos.x + side * (34 + index * 18), 28, VIEWPORT_WIDTH - 28);
    run.enemies.push(
      createEnemy({
        id: makeId("spawn"),
        kind:
          boss.bossTier === 3 && index === spawnCount - 1
            ? "caster"
            : run.elapsed % 2 > 1
              ? "charger"
              : "patrol",
        maxX: x + 54,
        minX: x - 54,
        x,
        y: boss.pos.y + 20,
      }),
    );
  }
}

function fireProjectileFromPoint(
  run: RunState,
  origin: Vec2,
  target: Vec2,
  speed: number,
  kind: EnemyProjectile["kind"],
): void {
  const velocity = normalize({ x: target.x - origin.x, y: target.y - origin.y });

  run.projectiles.push({
    color: kind === "orb" ? "#fb7185" : "#67e8f9",
    id: makeId("side-shot"),
    kind,
    pos: origin,
    radius: kind === "orb" ? 5 : 3,
    ttl: 3,
    velocity: { x: velocity.x * speed, y: velocity.y * speed },
  });
}

function getBossIntensity(boss: Enemy): number {
  const stageProgress = getBossStageProgress(boss);
  const tierBonus = (boss.bossTier - 1) * (0.12 + stageProgress * 0.12);
  const threatBonus = boss.threat * (0.018 + stageProgress * 0.012);
  const enragedBonus = boss.hp < boss.maxHp * 0.45 ? 0.16 + stageProgress * 0.18 : 0;

  return clamp(0.78 + stageProgress * 0.42 + tierBonus + threatBonus + enragedBonus, 0.78, 2.45);
}

function getBossStageProgress(boss: Enemy): number {
  return getStageProgress(boss.stageRank);
}

function getStageProgress(stageRank: number): number {
  return clamp((stageRank - 1) / Math.max(1, STAGES.length - 1), 0, 1);
}

function updateHazards(run: RunState, dt: number): void {
  const remaining: BossHazard[] = [];

  for (const hazard of run.hazards) {
    hazard.ttl -= dt;
    hazard.telegraph = Math.max(0, hazard.telegraph - dt);

    if (hazard.telegraph <= 0 && hazard.damageWindow > 0) {
      hazard.damageWindow -= dt;
      if (isPlayerInHazard(run, hazard)) {
        hazard.damageWindow = 0;
        damagePlayer(run, "보스 패턴에 휘말렸습니다");
      }
    }

    if (hazard.ttl > 0) {
      remaining.push(hazard);
    }
  }

  run.hazards = remaining;
}

function isPlayerInHazard(run: RunState, hazard: BossHazard): boolean {
  const playerRect = actorRect(run.player);

  if (hazard.kind === "shockwave") {
    const d = distance(run.player.pos, hazard.pos);
    return d >= hazard.radius - hazard.width && d <= hazard.radius + hazard.width + 7;
  }

  const rect = {
    height: hazard.height,
    width: hazard.width,
    x: hazard.pos.x - hazard.width / 2,
    y: hazard.pos.y - hazard.height / 2,
  };

  if (hazard.kind === "pillar") {
    return circleRectOverlap(hazard.pos, hazard.radius, playerRect);
  }

  return rectsOverlap(playerRect, rect);
}

function updateProjectiles(run: RunState, dt: number): void {
  const remaining: EnemyProjectile[] = [];

  for (const projectile of run.projectiles) {
    projectile.ttl -= dt;
    projectile.pos.x += projectile.velocity.x * dt;
    projectile.pos.y += projectile.velocity.y * dt;

    if (circleRectOverlap(projectile.pos, projectile.radius, actorRect(run.player))) {
      damagePlayer(run, "사이오닉 탄환에 맞았습니다");
      continue;
    }

    if (
      projectile.ttl > 0 &&
      projectile.pos.x > -8 &&
      projectile.pos.x < VIEWPORT_WIDTH + 8 &&
      projectile.pos.y > -8 &&
      projectile.pos.y < VIEWPORT_HEIGHT + 8
    ) {
      remaining.push(projectile);
    }
  }

  run.projectiles = remaining;
}

function damagePlayer(run: RunState, message: string): void {
  const player = run.player;

  if (player.invincibleTimer > 0) {
    return;
  }

  if (player.shieldTimer > 0) {
    player.shieldTimer = 0;
    player.invincibleTimer = 0.75;
    run.message = "보호막이 충격을 흡수했습니다";
    run.particles.push(...createBurst(player.pos, "#67e8f9", 26, 92));
    return;
  }

  run.lives -= 1;
  run.message = message;
  run.particles.push(...createBurst(player.pos, "#fb7185", 28, 112));

  if (run.lives <= 0) {
    run.phase = "gameover";
    run.phaseTimer = 0;
    run.message = "광전사 형제가 쓰러졌습니다";
    return;
  }

  const stage = getStage(run);
  run.player = {
    ...createPlayer(stage.start),
    bombCooldownScale: player.bombCooldownScale,
    bombRange: player.bombRange,
  };
  run.bombs = [];
  run.projectiles = [];
  run.hazards = [];

  if (player.carryingKey) {
    run.key = { available: true, pos: { ...stage.keySpawn } };
  }
}

function collectPickups(run: RunState, dt: number): void {
  const remaining: Pickup[] = [];

  for (const pickup of run.pickups) {
    pickup.ttl -= dt;

    if (distance(run.player.pos, pickup.pos) <= pickup.radius + 9) {
      applyPickup(run, pickup.kind);
      run.particles.push(...createBurst(pickup.pos, "#fef3c7", 16, 72));
      continue;
    }

    if (pickup.ttl > 0) {
      remaining.push(pickup);
    }
  }

  run.pickups = remaining;
}

function applyPickup(run: RunState, kind: BonusKind): void {
  switch (kind) {
    case "cooldown":
      run.player.bombCooldownScale = Math.max(0.55, run.player.bombCooldownScale * 0.86);
      run.message = "폭탄 회로 가속";
      break;
    case "range":
      run.player.bombRange = Math.min(43, run.player.bombRange + 6);
      run.message = "폭발 범위 증폭";
      break;
    case "shield":
      run.player.shieldTimer = 6;
      run.message = "보호막 충전";
      break;
    case "speed":
      run.player.speedBoostTimer = 7;
      run.message = "돌진 보조장치 가동";
      break;
    case "gem":
    default:
      run.score += 500;
      run.message = "수정 보너스 획득";
      break;
  }
}

function spawnPickup(run: RunState, crate: CrystalCrate): void {
  run.pickups.push({
    id: makeId("pickup"),
    kind: crate.bonus,
    pos: { x: crate.x + crate.width / 2, y: crate.y - 5 },
    radius: crate.bonus === "gem" ? 4 : 5,
    ttl: 9,
  });
}

function handleKeyAndPortal(run: RunState, input: InputState): void {
  const player = run.player;

  if (
    input.useQueued &&
    run.key.available &&
    !player.carryingKey &&
    distance(player.pos, run.key.pos) < 16
  ) {
    player.carryingKey = true;
    run.key.available = false;
    run.message = "수정 열쇠 운반 중";
  } else if (input.useQueued && player.carryingKey) {
    player.carryingKey = false;
    run.key = { available: true, pos: { x: player.pos.x, y: player.pos.y - 12 } };
    run.message = "수정 열쇠를 내려놓았습니다";
  }

  if (player.carryingKey && rectsOverlap(actorRect(player), getStage(run).portal)) {
    player.carryingKey = false;
    run.score += 1000 + getStage(run).id * 250;
    run.phase = "stageClear";
    run.phaseTimer = 1.12;
    run.message = "차원문 안정화";
    run.particles.push(...createBurst(player.pos, "#facc15", 42, 132));
  }
}

function maybeOpenKeyRun(run: RunState): void {
  if (run.stageMode !== "combat" || run.enemies.length > 0) {
    return;
  }

  const stage = getStage(run);

  if (run.bossIndex < stage.bosses.length) {
    spawnNextBoss(run, stage);
    return;
  }

  run.stageMode = "keyRun";
  run.key = { available: true, pos: { ...stage.keySpawn } };
  run.enemies = stage.reinforcements.map((definition) =>
    createEnemy({ ...definition, id: `${definition.id}-${makeId("r")}` }),
  );
  run.message = "수정 열쇠를 차원문으로 운반하세요";
  run.score += 600;
}

function spawnNextBoss(run: RunState, stage: StageDefinition): void {
  const bossDefinition = stage.bosses[run.bossIndex];
  const boss = createEnemy(bossDefinition);
  run.bossIndex += 1;
  run.bombs = [];
  run.hazards = [];
  run.projectiles = [];
  run.enemies = [boss];
  run.particles.push(...createBurst(boss.pos, boss.bossTier === 3 ? "#f0abfc" : "#67e8f9", 44, 120));
  run.message =
    boss.bossTier === 3
      ? `${run.bossIndex}/3 최종 보스 ${boss.displayName} 등장`
      : `${run.bossIndex}/3 보스 ${boss.displayName} 등장`;
}

function advanceStage(run: RunState): void {
  const nextStageIndex = run.stageIndex + 1;

  if (nextStageIndex >= STAGES.length) {
    run.phase = "victory";
    run.phaseTimer = 0;
    run.message = "모든 차원문을 정화했습니다";
    return;
  }

  const next = createStageState(nextStageIndex, run.lives, run.score, "playing");
  Object.assign(run, next);
}

function updatePlayerTimers(player: RunState["player"], dt: number): void {
  player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
  player.padCooldown = Math.max(0, player.padCooldown - dt);
  player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  player.speedBoostTimer = Math.max(0, player.speedBoostTimer - dt);
}

function updateParticles(particles: Particle[], dt: number): void {
  for (const particle of particles) {
    particle.ttl -= dt;
    particle.pos.x += particle.velocity.x * dt;
    particle.pos.y += particle.velocity.y * dt;
    particle.velocity.x *= Math.exp(-2.2 * dt);
    particle.velocity.y += GRAVITY * 0.15 * dt;
  }

  removeExpired(particles);
}

function updateExplosions(explosions: Explosion[], dt: number): void {
  for (const explosion of explosions) {
    explosion.ttl -= dt;
  }

  removeExpired(explosions);
}

function removeExpired(items: Array<{ ttl: number }>): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].ttl <= 0) {
      items.splice(index, 1);
    }
  }
}

function consumeQueuedInput(input: InputState): void {
  input.bombQueued = false;
  input.jumpQueued = false;
  input.startQueued = false;
  input.useQueued = false;
}

function actorRect(actor: {
  height: number;
  pos: Vec2;
  width: number;
}): Rect {
  return {
    height: actor.height,
    width: actor.width,
    x: actor.pos.x - actor.width / 2,
    y: actor.pos.y - actor.height / 2,
  };
}

function findPairedPad(pads: RiftPad[], activePad: RiftPad): RiftPad | undefined {
  return pads.find((pad) => pad.pairId === activePad.pairId && pad.id !== activePad.id);
}

function createBurst(origin: Vec2, color: string, count: number, speed: number): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.28;
    const velocity = speed * (0.45 + Math.random() * 0.78);

    return {
      color,
      life: 0.32 + Math.random() * 0.35,
      pos: { ...origin },
      radius: 1.2 + Math.random() * 2.4,
      ttl: 0.32 + Math.random() * 0.35,
      velocity: { x: Math.cos(angle) * velocity, y: Math.sin(angle) * velocity },
    };
  });
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function circleRectOverlap(center: Vec2, radius: number, rect: Rect): boolean {
  const closestX = clamp(center.x, rect.x, rect.x + rect.width);
  const closestY = clamp(center.y, rect.y, rect.y + rect.height);

  return distance(center, { x: closestX, y: closestY }) <= radius;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;

  return { x: vector.x / length, y: vector.y / length };
}

function rotateVector(vector: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function makeId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}
