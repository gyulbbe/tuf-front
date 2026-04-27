import { MAX_DELTA_SECONDS } from "../lib/constants";
import type { GameLoopHandle } from "../lib/types";

export type GameLoopCallback = (
  deltaSeconds: number,
  elapsedSeconds: number,
) => void;

export function startGameLoop(callback: GameLoopCallback): GameLoopHandle {
  let previousTime = performance.now();
  let rafId: number | null = null;
  let stopped = false;

  function tick(currentTime: number): void {
    if (stopped) {
      return;
    }

    const deltaSeconds = Math.min(
      (currentTime - previousTime) / 1000,
      MAX_DELTA_SECONDS,
    );

    previousTime = currentTime;
    callback(deltaSeconds, currentTime / 1000);
    rafId = window.requestAnimationFrame(tick);
  }

  rafId = window.requestAnimationFrame(tick);

  return {
    stop: (): void => {
      stopped = true;

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
