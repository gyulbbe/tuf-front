"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { GAME_IMAGE_KEYS, loadImages } from "./engine/assets";
import type { ImageAssets } from "./engine/assets";
import { clearEffects, tickEffects } from "./engine/effects";
import { tickEnemies } from "./engine/enemies";
import { startGameLoop } from "./engine/game-loop";
import { createKeyboardInput } from "./engine/input";
import { tickPickups } from "./engine/pickups";
import { renderWorld } from "./engine/renderer";
import { tickShooting } from "./engine/shooting";
import {
  AIM_MOVE_MULTIPLIER,
  CAMERA_PLANE_LENGTH,
  CANVAS_MIN_HEIGHT,
  CANVAS_MIN_WIDTH,
  COLLISION_RADIUS,
  DEBUG_HUD_INTERVAL_MS,
  MAX_PITCH_RATIO,
  MOUSE_SENSITIVITY,
  RENDER_SCALE,
  RUN_SPEED,
  STRAFE_SPEED,
  WALK_SPEED,
} from "./lib/constants";
import type { GameLoopHandle, KeyboardInput, Player, Vec2, World } from "./lib/types";
import { WEAPONS } from "./lib/weapons";
import { createInitialGameState } from "./state/game";
import type { GamePhase, GameState } from "./state/game";
import { createInitialInventory } from "./state/inventory";
import type { InventoryState } from "./state/inventory";
import { createInitialWorld } from "./state/world";
import { Crosshair } from "./ui/crosshair";
import { GameoverScreen } from "./ui/gameover-screen";
import { Hud } from "./ui/hud";
import type { HudWeaponState } from "./ui/hud";
import { HurtOverlay } from "./ui/hurt-overlay";
import { PauseScreen } from "./ui/pause-screen";
import { ScopeOverlay } from "./ui/scope-overlay";
import { TitleScreen } from "./ui/title-screen";
import { VictoryScreen } from "./ui/victory-screen";

type HudSnapshot = {
  elapsedMs: number;
  floor: number;
  maxFloor: number;
  hurtFlashAlpha: number;
  isAiming: boolean;
  isScoped: boolean;
  killCount: number;
  phase: GamePhase;
  playerHp: number;
  playerMaxHp: number;
  score: number;
  weapon: HudWeaponState;
};

type FloorTransition = {
  floor: number;
  id: number;
} | null;

const INVINCIBLE_CHEAT_CODE = "blackmagic";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createAmmoLabel(inventory: InventoryState): string {
  const weapon = WEAPONS[inventory.current];

  if (weapon.clipSize === null) {
    return "\u221e";
  }

  return `${inventory.ammo[inventory.current]} / ${weapon.clipSize}`;
}

function createHudSnapshot(
  world: World,
  inventory: InventoryState,
  game: GameState,
  now: number,
): HudSnapshot {
  const weapon = WEAPONS[inventory.current];
  const hurtRemaining = Math.max(0, game.hurtFlashUntil - now);

  return {
    elapsedMs: Math.max(0, (game.endedAt ?? now) - game.startedAt),
    floor: world.floor,
    hurtFlashAlpha: Math.min(0.35, (hurtRemaining / 250) * 0.35),
    isAiming: inventory.isAiming,
    isScoped: inventory.isAiming && weapon.scopeMode,
    killCount: game.killCount,
    maxFloor: world.maxFloor,
    phase: game.phase,
    playerHp: game.playerHp,
    playerMaxHp: game.playerMaxHp,
    score: game.score,
    weapon: {
      ammoLabel: createAmmoLabel(inventory),
      color: weapon.hudColor,
      isReloading: inventory.isReloading,
      name: weapon.name,
    },
  };
}

function getTileValue(world: World, x: number, y: number): number {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  const row = world.map[mapY];

  if (!row) {
    return 1;
  }

  return row[mapX] ?? 1;
}

function canOccupy(world: World, x: number, y: number): boolean {
  return (
    getTileValue(world, x - COLLISION_RADIUS, y - COLLISION_RADIUS) === 0 &&
    getTileValue(world, x + COLLISION_RADIUS, y - COLLISION_RADIUS) === 0 &&
    getTileValue(world, x - COLLISION_RADIUS, y + COLLISION_RADIUS) === 0 &&
    getTileValue(world, x + COLLISION_RADIUS, y + COLLISION_RADIUS) === 0
  );
}

function movePlayer(
  world: World,
  direction: 1 | -1,
  speed: number,
  deltaSeconds: number,
): void {
  const { player } = world;
  const moveDistance = direction * speed * deltaSeconds;
  const nextX = player.pos.x + player.dir.x * moveDistance;
  const nextY = player.pos.y + player.dir.y * moveDistance;

  if (canOccupy(world, nextX, player.pos.y)) {
    player.pos.x = nextX;
  }

  if (canOccupy(world, player.pos.x, nextY)) {
    player.pos.y = nextY;
  }
}

function strafePlayer(
  world: World,
  direction: 1 | -1,
  speed: number,
  deltaSeconds: number,
): void {
  const { player } = world;
  const strafeDistance = direction * speed * deltaSeconds;
  const rightX = -player.dir.y;
  const rightY = player.dir.x;
  const nextX = player.pos.x + rightX * strafeDistance;
  const nextY = player.pos.y + rightY * strafeDistance;

  if (canOccupy(world, nextX, player.pos.y)) {
    player.pos.x = nextX;
  }

  if (canOccupy(world, player.pos.x, nextY)) {
    player.pos.y = nextY;
  }
}

function rotateVector(vector: { x: number; y: number }, radians: number): void {
  const oldX = vector.x;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  vector.x = vector.x * cos - vector.y * sin;
  vector.y = oldX * sin + vector.y * cos;
}

function rotatePlayer(player: Player, radians: number): void {
  // Rotate both direction and camera plane with the same 2D rotation matrix.
  // Keeping them locked preserves the Lode raycaster camera basis.
  rotateVector(player.dir, radians);
  rotateVector(player.plane, radians);
}

function setCameraPlaneLength(player: Player, length: number): void {
  player.plane.x = -player.dir.y * length;
  player.plane.y = player.dir.x * length;
}

function applyCameraPlane(player: Player): void {
  setCameraPlaneLength(player, CAMERA_PLANE_LENGTH);
}

function updatePlayer(
  world: World,
  input: KeyboardInput,
  inventory: InventoryState,
  deltaSeconds: number,
): void {
  const aimMultiplier = inventory.isAiming ? AIM_MOVE_MULTIPLIER : 1;
  const forwardSpeed =
    (input.isRunning() ? RUN_SPEED : WALK_SPEED) * aimMultiplier;
  const strafeSpeed =
    (input.isRunning() ? RUN_SPEED : STRAFE_SPEED) * aimMultiplier;

  if (input.isPressed("KeyW")) {
    movePlayer(world, 1, forwardSpeed, deltaSeconds);
  }

  if (input.isPressed("KeyS")) {
    movePlayer(world, -1, forwardSpeed, deltaSeconds);
  }

  if (input.isPressed("KeyA")) {
    strafePlayer(world, -1, strafeSpeed, deltaSeconds);
  }

  if (input.isPressed("KeyD")) {
    strafePlayer(world, 1, strafeSpeed, deltaSeconds);
  }
}

function isAtExit(world: World): boolean {
  return (
    Math.hypot(
      world.player.pos.x - world.exit.x,
      world.player.pos.y - world.exit.y,
    ) <= world.exit.radius
  );
}

export default function GameRoot(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World>(createInitialWorld());
  const inventoryRef = useRef<InventoryState>(createInitialInventory());
  const gameRef = useRef<GameState>(createInitialGameState());
  const assetsRef = useRef<ImageAssets>({});
  const playerVelocityRef = useRef<Vec2>({ x: 0, y: 0 });
  const inputRef = useRef<KeyboardInput | null>(null);
  const loopRef = useRef<GameLoopHandle | null>(null);
  const lockedRef = useRef(false);
  const loadTokenRef = useRef(0);
  const floorTransitionTimeoutRef = useRef<number | null>(null);
  const pickupNoticeTimeoutRef = useRef<number | null>(null);
  const cheatBufferRef = useRef("");
  const [isLocked, setIsLocked] = useState(false);
  const [floorTransition, setFloorTransition] = useState<FloorTransition>(null);
  const [pickupNotice, setPickupNotice] = useState<string | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<HudSnapshot>(() =>
    createHudSnapshot(
      createInitialWorld(),
      createInitialInventory(),
      createInitialGameState(),
      performance.now(),
    ),
  );

  function commitHudSnapshot(): void {
    setHudSnapshot(
      createHudSnapshot(
        worldRef.current,
        inventoryRef.current,
        gameRef.current,
        performance.now(),
      ),
    );
  }

  function clearPickupNotice(): void {
    setPickupNotice(null);

    if (pickupNoticeTimeoutRef.current !== null) {
      window.clearTimeout(pickupNoticeTimeoutRef.current);
      pickupNoticeTimeoutRef.current = null;
    }
  }

  function clearFloorTransition(): void {
    setFloorTransition(null);

    if (floorTransitionTimeoutRef.current !== null) {
      window.clearTimeout(floorTransitionTimeoutRef.current);
      floorTransitionTimeoutRef.current = null;
    }
  }

  function showFloorTransition(floor: number): void {
    setFloorTransition({ floor, id: Date.now() });

    if (floorTransitionTimeoutRef.current !== null) {
      window.clearTimeout(floorTransitionTimeoutRef.current);
    }

    floorTransitionTimeoutRef.current = window.setTimeout(() => {
      setFloorTransition(null);
      floorTransitionTimeoutRef.current = null;
    }, 1300);
  }

  function requestGamePointerLock(): void {
    const canvas = canvasRef.current;

    if (!canvas || document.pointerLockElement === canvas) {
      return;
    }

    void Promise.resolve(canvas.requestPointerLock()).catch(() => undefined);
  }

  function resetRuntime(phase: GamePhase, clearAssets: boolean): void {
    worldRef.current = createInitialWorld();
    inventoryRef.current = createInitialInventory();
    gameRef.current = createInitialGameState(phase);
    playerVelocityRef.current = { x: 0, y: 0 };
    cheatBufferRef.current = "";
    inputRef.current?.reset();
    clearEffects();
    clearFloorTransition();
    clearPickupNotice();

    if (clearAssets) {
      assetsRef.current = {};
    }

    commitHudSnapshot();
  }

  function startGame(): void {
    const loadToken = loadTokenRef.current + 1;

    loadTokenRef.current = loadToken;
    resetRuntime("loading", true);
    requestGamePointerLock();

    void loadImages(GAME_IMAGE_KEYS).then((assets) => {
      if (loadTokenRef.current !== loadToken) {
        return;
      }

      assetsRef.current = assets;
      gameRef.current.phase = "playing";
      gameRef.current.startedAt = performance.now();
      gameRef.current.endedAt = undefined;
      commitHudSnapshot();
    });
  }

  function resumeGame(): void {
    if (gameRef.current.phase !== "paused") {
      return;
    }

    gameRef.current.phase = "playing";
    requestGamePointerLock();
    commitHudSnapshot();
  }

  function retryGame(): void {
    loadTokenRef.current += 1;
    resetRuntime("playing", false);
    requestGamePointerLock();
  }

  function returnToTitle(): void {
    loadTokenRef.current += 1;

    if (document.pointerLockElement === canvasRef.current) {
      document.exitPointerLock();
    }

    resetRuntime("title", true);
  }

  useEffect((): (() => void) | undefined => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    const activeCanvas: HTMLCanvasElement = canvas;
    const activeContext: CanvasRenderingContext2D = context;
    const input = createKeyboardInput(window, () => lockedRef.current);
    let hudTimeSeconds = 0;

    inputRef.current = input;

    function clampLookV(): void {
      const maxLookV = activeCanvas.height * MAX_PITCH_RATIO;
      const world = worldRef.current;

      world.lookV = clamp(world.lookV, -maxLookV, maxLookV);
    }

    function renderFrame(now: number): void {
      const game = gameRef.current;

      renderWorld(activeContext, worldRef.current, {
        imageAssets: assetsRef.current,
        inputFiring:
          lockedRef.current && game.phase === "playing" && input.isFiring(),
        inventory: inventoryRef.current,
        isRunning: input.isRunning(),
        now,
        playerVelocity: playerVelocityRef.current,
      });
    }

    function resizeCanvas(): void {
      activeCanvas.width = Math.max(
        CANVAS_MIN_WIDTH,
        Math.floor(window.innerWidth * RENDER_SCALE),
      );
      activeCanvas.height = Math.max(
        CANVAS_MIN_HEIGHT,
        Math.floor(window.innerHeight * RENDER_SCALE),
      );
      activeContext.imageSmoothingEnabled = false;
      clampLookV();
      renderFrame(performance.now());
    }

    function handlePointerLockChange(): void {
      const locked = document.pointerLockElement === activeCanvas;

      lockedRef.current = locked;
      setIsLocked(locked);

      if (locked) {
        return;
      }

      input.reset();

      if (gameRef.current.phase === "playing") {
        gameRef.current.phase = "paused";
        commitHudSnapshot();
      }
    }

    function handleCanvasClick(): void {
      if (
        gameRef.current.phase !== "playing" ||
        document.pointerLockElement === activeCanvas
      ) {
        return;
      }

      void Promise.resolve(activeCanvas.requestPointerLock()).catch(() => undefined);
    }

    function handleMouseMove(event: MouseEvent): void {
      const world = worldRef.current;
      const inventory = inventoryRef.current;

      if (
        document.pointerLockElement !== activeCanvas ||
        gameRef.current.phase !== "playing"
      ) {
        return;
      }

      // Pointer Lock gives relative movement. Horizontal deltas rotate the
      // camera basis; vertical deltas fake pitch by shifting wall columns.
      const weapon = WEAPONS[inventory.current];
      const sensitivity =
        MOUSE_SENSITIVITY * (inventory.isAiming ? weapon.zoomFactor : 1);

      rotatePlayer(world.player, event.movementX * sensitivity);
      world.lookV -= event.movementY * RENDER_SCALE;
      clampLookV();
    }

    function handleCheatKeyDown(event: KeyboardEvent): void {
      if (gameRef.current.phase !== "playing" || event.key.length !== 1) {
        return;
      }

      cheatBufferRef.current = (
        cheatBufferRef.current + event.key.toLowerCase()
      ).slice(-INVINCIBLE_CHEAT_CODE.length);

      if (cheatBufferRef.current !== INVINCIBLE_CHEAT_CODE) {
        return;
      }

      gameRef.current.isInvincible = true;
      cheatBufferRef.current = "";
      commitHudSnapshot();
    }

    function showPickupNotice(message: string): void {
      setPickupNotice(message);

      if (pickupNoticeTimeoutRef.current !== null) {
        window.clearTimeout(pickupNoticeTimeoutRef.current);
      }

      pickupNoticeTimeoutRef.current = window.setTimeout(() => {
        setPickupNotice(null);
        pickupNoticeTimeoutRef.current = null;
      }, 2000);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleCheatKeyDown);
    activeCanvas.addEventListener("click", handleCanvasClick);

    const loop = startGameLoop((deltaSeconds: number): void => {
      const now = performance.now();
      const game = gameRef.current;
      const world = worldRef.current;
      const inventory = inventoryRef.current;

      if (input.consumePauseTriggered()) {
        if (game.phase === "playing") {
          game.phase = "paused";
          input.reset();

          if (document.pointerLockElement === activeCanvas) {
            document.exitPointerLock();
          }

          commitHudSnapshot();
        } else if (game.phase === "paused") {
          game.phase = "playing";
          void Promise.resolve(activeCanvas.requestPointerLock()).catch(
            () => undefined,
          );
          commitHudSnapshot();
        }
      }

      if (game.phase === "playing" && lockedRef.current) {
        const previousX = world.player.pos.x;
        const previousY = world.player.pos.y;

        applyCameraPlane(world.player);
        updatePlayer(world, input, inventory, deltaSeconds);
        playerVelocityRef.current =
          deltaSeconds > 0
            ? {
                x: (world.player.pos.x - previousX) / deltaSeconds,
                y: (world.player.pos.y - previousY) / deltaSeconds,
              }
            : { x: 0, y: 0 };
        tickPickups(world, inventory, game, showPickupNotice);
        tickEnemies(deltaSeconds, now, world, game);

        if (game.phase === "playing") {
          tickShooting(deltaSeconds, now, input, inventory, world, game);
          tickEffects(now);
        }

        if (game.phase === "playing" && isAtExit(world)) {
          if (world.floor >= world.maxFloor) {
            game.phase = "victory";
            game.endedAt = now;

            if (document.pointerLockElement === activeCanvas) {
              document.exitPointerLock();
            }
          } else {
            const nextFloor = world.floor + 1;

            worldRef.current = createInitialWorld(nextFloor);
            game.playerHp = game.playerMaxHp;
            game.hurtFlashUntil = 0;
            playerVelocityRef.current = { x: 0, y: 0 };
            input.reset();
            clearEffects();
            showFloorTransition(nextFloor);
            commitHudSnapshot();
          }
        }

        if (game.phase !== "playing" && document.pointerLockElement === activeCanvas) {
          document.exitPointerLock();
        }
      } else {
        playerVelocityRef.current = { x: 0, y: 0 };
      }

      renderFrame(now);

      hudTimeSeconds += deltaSeconds;

      if (
        hudTimeSeconds * 1000 >= DEBUG_HUD_INTERVAL_MS ||
        game.hurtFlashUntil > now
      ) {
        setHudSnapshot(
          createHudSnapshot(
            worldRef.current,
            inventory,
            game,
            now,
          ),
        );
        hudTimeSeconds = 0;
      }
    });

    loopRef.current = loop;

    return (): void => {
      loop.stop();
      input.dispose();
      clearFloorTransition();
      clearPickupNotice();

      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleCheatKeyDown);
      activeCanvas.removeEventListener("click", handleCanvasClick);

      if (document.pointerLockElement === activeCanvas) {
        document.exitPointerLock();
      }

      loopRef.current = null;
      inputRef.current = null;
      lockedRef.current = false;
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <canvas
        ref={canvasRef}
        aria-label="Escape FPS raycasting viewport"
        className="block h-screen w-screen bg-black"
      />
      <Hud
        floor={hudSnapshot.floor}
        killCount={hudSnapshot.killCount}
        maxFloor={hudSnapshot.maxFloor}
        pickupNotice={pickupNotice}
        playerHp={hudSnapshot.playerHp}
        playerMaxHp={hudSnapshot.playerMaxHp}
        score={hudSnapshot.score}
        weapon={hudSnapshot.weapon}
      />
      {isLocked && hudSnapshot.phase === "playing" && !hudSnapshot.isScoped && (
        <Crosshair isAiming={hudSnapshot.isAiming} />
      )}
      {isLocked && hudSnapshot.phase === "playing" && hudSnapshot.isScoped && (
        <ScopeOverlay />
      )}
      <HurtOverlay alpha={hudSnapshot.hurtFlashAlpha} />
      {floorTransition && hudSnapshot.phase === "playing" && (
        <div
          key={floorTransition.id}
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden bg-emerald-200/10"
        >
          <div className="absolute h-[140vmax] w-[140vmax] animate-ping rounded-full border border-emerald-200/35" />
          <div className="absolute h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(circle_at_center,rgba(190,255,210,0.28),rgba(20,160,95,0.12)_34%,rgba(0,0,0,0)_68%)]" />
          <div className="relative rounded-lg border border-emerald-200/45 bg-black/75 px-8 py-5 text-center shadow-2xl shadow-emerald-500/30 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/80">
              Door reached
            </p>
            <p className="mt-2 text-4xl font-black tracking-normal text-white">
              FLOOR {floorTransition.floor}
            </p>
          </div>
        </div>
      )}
      {hudSnapshot.phase === "title" && (
        <TitleScreen onStart={startGame} phase="title" />
      )}
      {hudSnapshot.phase === "loading" && (
        <TitleScreen onStart={startGame} phase="loading" />
      )}
      {hudSnapshot.phase === "paused" && (
        <PauseScreen onResume={resumeGame} onTitle={returnToTitle} />
      )}
      {hudSnapshot.phase === "gameover" && (
        <GameoverScreen killCount={hudSnapshot.killCount} onRetry={retryGame} />
      )}
      {hudSnapshot.phase === "victory" && (
        <VictoryScreen
          elapsedMs={hudSnapshot.elapsedMs}
          killCount={hudSnapshot.killCount}
          onReplay={retryGame}
        />
      )}
      {hudSnapshot.phase === "playing" && !isLocked && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 px-6 text-center">
          <div className="rounded-lg border border-white/20 bg-black/80 px-6 py-5 text-white shadow-2xl backdrop-blur">
            <p className="text-lg font-semibold">Click to continue</p>
            <p className="mt-2 text-sm text-white/70">Press ESC to pause</p>
          </div>
        </div>
      )}
    </div>
  );
}
