import type { InputKey, KeyboardInput, MovementKey } from "../lib/types";
import type { WeaponId } from "../lib/weapons";

const INPUT_KEYS: ReadonlySet<string> = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyP",
  "KeyR",
  "ShiftLeft",
  "ShiftRight",
  "Digit1",
  "Digit2",
  "Digit3",
]);

const SWITCH_KEYS: Readonly<Record<string, WeaponId>> = {
  Digit1: "machinegun",
  Digit2: "rifle",
  Digit3: "flamethrower",
};

export function createKeyboardInput(
  target: Window,
  isEnabled: () => boolean,
): KeyboardInput {
  const pressedKeys = new Set<InputKey>();
  let aimTriggered = false;
  let fireTriggered = false;
  let isFiring = false;
  let pauseTriggered = false;
  let reloadTriggered = false;
  let switchTriggered: WeaponId | null = null;

  function handleKeyDown(event: KeyboardEvent): void {
    if (!INPUT_KEYS.has(event.code)) {
      return;
    }

    if (event.code === "KeyP" && !event.repeat) {
      pauseTriggered = true;
      event.preventDefault();
      return;
    }

    if (!isEnabled()) {
      return;
    }

    event.preventDefault();

    if (event.code === "KeyR" && !event.repeat) {
      reloadTriggered = true;
      return;
    }

    const weaponId = SWITCH_KEYS[event.code];

    if (weaponId && !event.repeat) {
      switchTriggered = weaponId;
      return;
    }

    pressedKeys.add(event.code as InputKey);
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (!INPUT_KEYS.has(event.code)) {
      return;
    }

    pressedKeys.delete(event.code as InputKey);

    if (isEnabled()) {
      event.preventDefault();
    }
  }

  function handleMouseDown(event: MouseEvent): void {
    if (!isEnabled()) {
      return;
    }

    if (event.button === 0) {
      fireTriggered = !isFiring;
      isFiring = true;
      event.preventDefault();
      return;
    }

    if (event.button === 2) {
      aimTriggered = true;
      event.preventDefault();
    }
  }

  function handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      isFiring = false;

      if (isEnabled()) {
        event.preventDefault();
      }
    }
  }

  function handleContextMenu(event: MouseEvent): void {
    if (isEnabled()) {
      event.preventDefault();
    }
  }

  function reset(): void {
    pressedKeys.clear();
    aimTriggered = false;
    fireTriggered = false;
    isFiring = false;
    pauseTriggered = false;
    reloadTriggered = false;
    switchTriggered = null;
  }

  target.addEventListener("keydown", handleKeyDown);
  target.addEventListener("keyup", handleKeyUp);
  target.addEventListener("mousedown", handleMouseDown);
  target.addEventListener("mouseup", handleMouseUp);
  target.addEventListener("contextmenu", handleContextMenu);

  return {
    consumeAimTriggered: (): boolean => {
      const triggered = aimTriggered;

      aimTriggered = false;

      return triggered;
    },
    consumeFireTriggered: (): boolean => {
      const triggered = fireTriggered;

      fireTriggered = false;

      return triggered;
    },
    consumePauseTriggered: (): boolean => {
      const triggered = pauseTriggered;

      pauseTriggered = false;

      return triggered;
    },
    consumeReloadTriggered: (): boolean => {
      const triggered = reloadTriggered;

      reloadTriggered = false;

      return triggered;
    },
    consumeSwitchTriggered: (): WeaponId | null => {
      const triggered = switchTriggered;

      switchTriggered = null;

      return triggered;
    },
    dispose: (): void => {
      reset();
      target.removeEventListener("keydown", handleKeyDown);
      target.removeEventListener("keyup", handleKeyUp);
      target.removeEventListener("mousedown", handleMouseDown);
      target.removeEventListener("mouseup", handleMouseUp);
      target.removeEventListener("contextmenu", handleContextMenu);
    },
    isFiring: (): boolean => isFiring,
    isRunning: (): boolean =>
      pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight"),
    isPressed: (code: MovementKey): boolean => pressedKeys.has(code),
    reset,
  };
}
