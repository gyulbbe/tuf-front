import { STAGES } from "./levels";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./engine";
import type {
  Bomb,
  BossHazard,
  BonusKind,
  CrystalCrate,
  Enemy,
  EnemyProjectile,
  Explosion,
  Particle,
  Pickup,
  Platform,
  PlatformKind,
  Rect,
  RiftPad,
  RunState,
} from "./types";

export function renderGame(context: CanvasRenderingContext2D, run: RunState): void {
  context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  drawBackground(context, run);
  drawPlatforms(context, STAGES[run.stageIndex].platforms);
  drawRiftPads(context, STAGES[run.stageIndex].pads, run.elapsed);
  drawPortal(context, STAGES[run.stageIndex].portal, run.elapsed, run.player.carryingKey);
  drawHazards(context, run.hazards);
  drawCrates(context, run.crates);
  drawPickups(context, run.pickups, run.elapsed);
  drawKey(context, run);
  drawProjectiles(context, run.projectiles);
  drawBombs(context, run.bombs);
  drawExplosions(context, run.explosions);
  drawEnemies(context, run.enemies, run.elapsed);
  drawPlayer(context, run);
  drawParticles(context, run.particles);
  drawVignette(context);
}

function drawBackground(context: CanvasRenderingContext2D, run: RunState): void {
  const gradient = context.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  gradient.addColorStop(0, "#08041a");
  gradient.addColorStop(0.58, "#10112b");
  gradient.addColorStop(1, "#05030d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = "#22d3ee";
  context.lineWidth = 1;

  for (let x = 0; x <= VIEWPORT_WIDTH; x += 16) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - 42, VIEWPORT_HEIGHT);
    context.stroke();
  }

  context.restore();

  for (let index = 0; index < 58; index += 1) {
    const x = (index * 73 + run.stageIndex * 19) % VIEWPORT_WIDTH;
    const y = 12 + ((index * 37 + run.stageIndex * 11) % 128);
    const pulse = 0.45 + Math.sin(run.elapsed * 2 + index) * 0.25;
    context.fillStyle = `rgba(255,255,255,${0.28 + pulse * 0.36})`;
    context.fillRect(x, y, index % 4 === 0 ? 2 : 1, 1);
  }

  context.fillStyle = "rgba(34, 211, 238, 0.08)";
  context.fillRect(0, 185, VIEWPORT_WIDTH, 39);
}

function drawPlatforms(context: CanvasRenderingContext2D, platforms: Platform[]): void {
  for (const platform of platforms) {
    const style = platformStyle(platform.kind);
    const gradient = context.createLinearGradient(
      platform.x,
      platform.y,
      platform.x,
      platform.y + platform.height,
    );
    gradient.addColorStop(0, style.top);
    gradient.addColorStop(1, style.bottom);
    context.fillStyle = gradient;
    context.fillRect(platform.x, platform.y, platform.width, platform.height);
    context.strokeStyle = style.stroke;
    context.lineWidth = 1;
    context.strokeRect(
      platform.x + 0.5,
      platform.y + 0.5,
      platform.width - 1,
      platform.height - 1,
    );

    context.fillStyle = "rgba(255,255,255,0.2)";
    for (let x = platform.x + 6; x < platform.x + platform.width; x += 18) {
      context.fillRect(x, platform.y + 2, 7, 1);
    }
  }
}

function platformStyle(kind: PlatformKind) {
  switch (kind) {
    case "dark":
      return { bottom: "#172554", stroke: "#38bdf8", top: "#312e81" };
    case "gold":
      return { bottom: "#92400e", stroke: "#fde68a", top: "#facc15" };
    case "stone":
    default:
      return { bottom: "#155e75", stroke: "#67e8f9", top: "#0f766e" };
  }
}

function drawRiftPads(context: CanvasRenderingContext2D, pads: RiftPad[], elapsed: number): void {
  for (const pad of pads) {
    const cx = pad.x + pad.width / 2;
    const cy = pad.y + pad.height / 2;

    context.save();
    context.translate(cx, cy);
    context.rotate(Math.sin(elapsed * 5 + cx) * 0.35);
    context.fillStyle = "rgba(34, 211, 238, 0.28)";
    context.fillRect(-pad.width / 2, -pad.height / 2, pad.width, pad.height);
    context.strokeStyle = "#a5f3fc";
    context.lineWidth = 1.2;
    context.strokeRect(-pad.width / 2, -pad.height / 2, pad.width, pad.height);
    context.fillStyle = "#fef08a";
    context.fillRect(-2, -2, 4, 4);
    context.restore();
  }
}

function drawPortal(
  context: CanvasRenderingContext2D,
  portal: Rect,
  elapsed: number,
  active: boolean,
): void {
  const cx = portal.x + portal.width / 2;
  const cy = portal.y + portal.height / 2;
  const pulse = Math.sin(elapsed * 5) * 1.6;

  context.save();
  context.translate(cx, cy);
  context.strokeStyle = active ? "#fef08a" : "#67e8f9";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(0, 0, portal.width / 2 + pulse, portal.height / 2, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = active ? "rgba(250,204,21,0.24)" : "rgba(34,211,238,0.17)";
  context.beginPath();
  context.ellipse(0, 0, portal.width / 2 - 2, portal.height / 2 - 3, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCrates(context: CanvasRenderingContext2D, crates: CrystalCrate[]): void {
  for (const crate of crates) {
    context.fillStyle = "#0e7490";
    context.fillRect(crate.x, crate.y, crate.width, crate.height);
    context.strokeStyle = "#67e8f9";
    context.strokeRect(crate.x + 0.5, crate.y + 0.5, crate.width - 1, crate.height - 1);
    context.fillStyle = "#fef3c7";
    context.beginPath();
    context.moveTo(crate.x + crate.width / 2, crate.y + 2);
    context.lineTo(crate.x + crate.width - 3, crate.y + crate.height / 2);
    context.lineTo(crate.x + crate.width / 2, crate.y + crate.height - 2);
    context.lineTo(crate.x + 3, crate.y + crate.height / 2);
    context.closePath();
    context.fill();
  }
}

function drawHazards(context: CanvasRenderingContext2D, hazards: BossHazard[]): void {
  for (const hazard of hazards) {
    const telegraphing = hazard.telegraph > 0;
    const alpha = telegraphing ? 0.16 + Math.sin(hazard.telegraph * 42) * 0.06 : 0.52;

    context.save();
    context.globalAlpha = alpha;

    if (hazard.kind === "shockwave") {
      context.strokeStyle = telegraphing ? "#f0abfc" : "#fb7185";
      context.lineWidth = telegraphing ? 2 : 4;
      context.beginPath();
      context.arc(hazard.pos.x, hazard.pos.y, hazard.radius, 0, Math.PI * 2);
      context.stroke();
    } else if (hazard.kind === "pillar") {
      context.fillStyle = telegraphing ? "#facc15" : "#fb7185";
      context.beginPath();
      context.ellipse(
        hazard.pos.x,
        hazard.pos.y,
        hazard.radius,
        hazard.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.strokeStyle = "#fef3c7";
      context.stroke();
    } else {
      context.fillStyle = telegraphing ? "#22d3ee" : "#e879f9";
      context.fillRect(
        hazard.pos.x - hazard.width / 2,
        hazard.pos.y - hazard.height / 2,
        hazard.width,
        hazard.height,
      );
      context.strokeStyle = "#f0abfc";
      context.strokeRect(
        hazard.pos.x - hazard.width / 2,
        hazard.pos.y - hazard.height / 2,
        hazard.width,
        hazard.height,
      );
    }

    context.restore();
  }
}

function drawPickups(context: CanvasRenderingContext2D, pickups: Pickup[], elapsed: number): void {
  for (const pickup of pickups) {
    const color = pickupColor(pickup.kind);
    const y = pickup.pos.y + Math.sin(elapsed * 5 + pickup.pos.x) * 2;
    context.fillStyle = color;
    context.beginPath();
    context.arc(pickup.pos.x, y, pickup.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#ffffff";
    context.stroke();
  }
}

function pickupColor(kind: BonusKind): string {
  switch (kind) {
    case "cooldown":
      return "#22d3ee";
    case "range":
      return "#fb923c";
    case "shield":
      return "#67e8f9";
    case "speed":
      return "#a3e635";
    case "gem":
    default:
      return "#facc15";
  }
}

function drawKey(context: CanvasRenderingContext2D, run: RunState): void {
  const pos = run.player.carryingKey
    ? { x: run.player.pos.x, y: run.player.pos.y - 18 }
    : run.key.available
      ? run.key.pos
      : null;

  if (!pos) {
    return;
  }

  context.save();
  context.translate(pos.x, pos.y);
  context.rotate(Math.sin(run.elapsed * 4) * 0.18);
  context.fillStyle = "#facc15";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 0);
  context.lineTo(0, 8);
  context.lineTo(-6, 0);
  context.closePath();
  context.fill();
  context.strokeStyle = "#fef3c7";
  context.stroke();
  context.fillStyle = "#67e8f9";
  context.fillRect(-2, -2, 4, 4);
  context.restore();
}

function drawBombs(context: CanvasRenderingContext2D, bombs: Bomb[]): void {
  for (const bomb of bombs) {
    const fuseRatio = Math.max(0, bomb.fuse / 0.9);
    context.fillStyle = "#22d3ee";
    context.beginPath();
    context.arc(bomb.pos.x, bomb.pos.y, bomb.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = fuseRatio < 0.35 ? "#fb7185" : "#fef08a";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(bomb.pos.x, bomb.pos.y, bomb.radius + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fuseRatio);
    context.stroke();
  }
}

function drawExplosions(context: CanvasRenderingContext2D, explosions: Explosion[]): void {
  for (const explosion of explosions) {
    const progress = 1 - explosion.ttl / explosion.life;
    context.strokeStyle = `rgba(250, 204, 21, ${1 - progress})`;
    context.lineWidth = 3 - progress * 2;
    context.beginPath();
    context.arc(explosion.pos.x, explosion.pos.y, explosion.radius * progress, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawEnemies(context: CanvasRenderingContext2D, enemies: Enemy[], elapsed: number): void {
  for (const enemy of enemies) {
    context.save();
    context.translate(enemy.pos.x, enemy.pos.y);
    if (enemy.hitFlash > 0) {
      context.globalAlpha = 0.55 + Math.sin(elapsed * 60) * 0.25;
    }

    switch (enemy.kind) {
      case "boss":
        drawBoss(context, enemy);
        break;
      case "caster":
        drawCaster(context, enemy);
        break;
      case "charger":
        drawCharger(context, enemy);
        break;
      case "patrol":
      default:
        drawPatrol(context, enemy);
        break;
    }

    context.restore();
  }
}

function drawPatrol(context: CanvasRenderingContext2D, enemy: Enemy): void {
  context.fillStyle = "#7c3aed";
  context.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
  context.fillStyle = "#c4b5fd";
  context.fillRect(-4, -6, 3, 3);
  context.fillRect(2, -6, 3, 3);
}

function drawCharger(context: CanvasRenderingContext2D, enemy: Enemy): void {
  context.fillStyle = "#be123c";
  context.beginPath();
  context.moveTo(enemy.direction * enemy.width / 2, 0);
  context.lineTo(-enemy.direction * enemy.width / 2, -enemy.height / 2);
  context.lineTo(-enemy.direction * enemy.width / 2, enemy.height / 2);
  context.closePath();
  context.fill();
  context.strokeStyle = "#fecdd3";
  context.stroke();
}

function drawCaster(context: CanvasRenderingContext2D, enemy: Enemy): void {
  context.fillStyle = "#4c1d95";
  context.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
  context.fillStyle = "#22d3ee";
  context.beginPath();
  context.arc(0, -5, 3, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#a5f3fc";
  context.beginPath();
  context.arc(0, 0, 8, 0.1, Math.PI - 0.1);
  context.stroke();
}

function drawBoss(context: CanvasRenderingContext2D, enemy: Enemy): void {
  const coreColor =
    enemy.bossTier === 3 ? "#facc15" : enemy.bossTier === 2 ? "#fb7185" : "#22d3ee";
  const shellColor =
    enemy.bossTier === 3 ? "#422006" : enemy.bossTier === 2 ? "#701a75" : "#2e1065";

  context.fillStyle = shellColor;
  context.beginPath();
  context.moveTo(0, -enemy.height / 2 - 6);
  context.lineTo(enemy.width / 2, -enemy.height / 2 + 4);
  context.lineTo(enemy.width / 2 + 4, enemy.height / 2 - 2);
  context.lineTo(0, enemy.height / 2 + 5);
  context.lineTo(-enemy.width / 2 - 4, enemy.height / 2 - 2);
  context.lineTo(-enemy.width / 2, -enemy.height / 2 + 4);
  context.closePath();
  context.fill();
  context.fillStyle = enemy.bossTier === 3 ? "#92400e" : "#701a75";
  context.fillRect(-enemy.width / 2 + 4, -enemy.height / 2 + 2, enemy.width - 8, enemy.height - 4);
  context.fillStyle = enemy.bossTier === 3 ? "#fef08a" : "#f0abfc";
  context.fillRect(-enemy.width / 2 + 5, -enemy.height / 2 - 5, 8, 8);
  context.fillRect(enemy.width / 2 - 13, -enemy.height / 2 - 5, 8, 8);

  if (enemy.bossTier === 3) {
    context.fillStyle = "#fef3c7";
    context.beginPath();
    context.moveTo(-12, -enemy.height / 2 - 8);
    context.lineTo(-7, -enemy.height / 2 - 17);
    context.lineTo(-2, -enemy.height / 2 - 8);
    context.moveTo(2, -enemy.height / 2 - 8);
    context.lineTo(7, -enemy.height / 2 - 17);
    context.lineTo(12, -enemy.height / 2 - 8);
    context.strokeStyle = "#fde68a";
    context.stroke();
  }

  context.fillStyle = coreColor;
  context.beginPath();
  context.arc(0, -1, 5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = enemy.bossTier === 3 ? "#fde68a" : "#f0abfc";
  context.lineWidth = 2;
  context.stroke();

  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  context.fillStyle = "#111827";
  context.fillRect(-20, -30, 40, 4);
  context.fillStyle = "#fb7185";
  context.fillRect(-20, -30, 40 * hpRatio, 4);
}

function drawProjectiles(context: CanvasRenderingContext2D, projectiles: EnemyProjectile[]): void {
  for (const projectile of projectiles) {
    context.fillStyle = projectile.color;
    context.beginPath();
    context.arc(projectile.pos.x, projectile.pos.y, projectile.radius, 0, Math.PI * 2);
    context.fill();

    if (projectile.kind === "needle") {
      context.strokeStyle = "rgba(240,171,252,0.42)";
      context.beginPath();
      context.moveTo(
        projectile.pos.x - projectile.velocity.x * 0.045,
        projectile.pos.y - projectile.velocity.y * 0.045,
      );
      context.lineTo(projectile.pos.x, projectile.pos.y);
      context.stroke();
    }

    context.strokeStyle = projectile.kind === "orb" ? "#fecdd3" : "#cffafe";
    context.stroke();
  }
}

function drawPlayer(context: CanvasRenderingContext2D, run: RunState): void {
  const player = run.player;

  if (player.invincibleTimer > 0 && Math.sin(run.elapsed * 38) < -0.15) {
    return;
  }

  context.save();
  context.translate(player.pos.x, player.pos.y);
  context.scale(player.facing, 1);

  if (player.shieldTimer > 0) {
    context.strokeStyle = "rgba(103,232,249,0.78)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, -1, 12, 16, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#d97706";
  context.fillRect(-8, -8, 5, 8);
  context.fillRect(3, -8, 5, 8);
  context.fillStyle = "#facc15";
  context.fillRect(-5, -10, 10, 16);
  context.fillStyle = "#fef08a";
  context.beginPath();
  context.moveTo(0, -17);
  context.lineTo(6, -11);
  context.lineTo(3, -5);
  context.lineTo(-3, -5);
  context.lineTo(-6, -11);
  context.closePath();
  context.fill();
  context.fillStyle = "#0f172a";
  context.fillRect(1, -11, 2, 2);
  context.fillStyle = "#111827";
  context.fillRect(-5, 6, 4, 8);
  context.fillRect(1, 6, 4, 8);
  context.strokeStyle = "rgba(103,232,249,0.35)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(13, -9);
  context.lineTo(20, -16);
  context.moveTo(-12, -8);
  context.lineTo(-18, -14);
  context.stroke();
  context.strokeStyle = "#67e8f9";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(7, -4);
  context.lineTo(18, -14);
  context.moveTo(-7, -3);
  context.lineTo(-16, -12);
  context.stroke();
  context.restore();
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const particle of particles) {
    const alpha = Math.max(0, particle.ttl / particle.life);
    context.fillStyle = withAlpha(particle.color, alpha);
    context.beginPath();
    context.arc(particle.pos.x, particle.pos.y, particle.radius * alpha, 0, Math.PI * 2);
    context.fill();
  }
}

function drawVignette(context: CanvasRenderingContext2D): void {
  const gradient = context.createRadialGradient(160, 98, 50, 160, 98, 205);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.48)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }

  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
