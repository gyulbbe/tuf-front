export type GamePhase =
  | "gameover"
  | "loading"
  | "paused"
  | "playing"
  | "title"
  | "victory";

export type GameState = {
  endedAt?: number;
  hurtFlashUntil: number;
  isInvincible: boolean;
  killCount: number;
  phase: GamePhase;
  playerHp: number;
  playerMaxHp: number;
  score: number;
  startedAt: number;
};

export function createInitialGameState(phase: GamePhase = "title"): GameState {
  return {
    hurtFlashUntil: 0,
    isInvincible: false,
    killCount: 0,
    phase,
    playerHp: 100,
    playerMaxHp: 100,
    score: 0,
    startedAt: performance.now(),
  };
}
