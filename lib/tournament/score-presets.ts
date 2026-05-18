export type TournamentScorePreset = [number, number];
export type TournamentScorePresetMode = "BEST_OF" | "ULTIMATE_BATTLE";

export function getRequiredWins(bestOf: number) {
  return Math.floor(bestOf / 2) + 1;
}

export function buildScorePresets(
  bestOf: number,
  mode: TournamentScorePresetMode = "BEST_OF",
): TournamentScorePreset[] {
  if (mode === "ULTIMATE_BATTLE") {
    return Array.from(
      { length: bestOf + 1 },
      (_, index) => [bestOf - index, index] as TournamentScorePreset,
    ).filter(([left, right]) => left !== right);
  }

  const requiredWins = getRequiredWins(bestOf);
  const firstWins = Array.from(
    { length: requiredWins },
    (_, loserScore) => [requiredWins, loserScore] as TournamentScorePreset,
  );
  const secondWins = Array.from(
    { length: requiredWins },
    (_, index) => [requiredWins - 1 - index, requiredWins] as TournamentScorePreset,
  );

  return [...firstWins, ...secondWins];
}

export function clampScorePresetIndex(
  index: number,
  presets: TournamentScorePreset[],
) {
  return Math.min(Math.max(index, 0), presets.length - 1);
}

export function getScoreButtonTargetIndex(
  playerIndex: number,
  scoreDelta: -1 | 1,
  presetIndex: number,
) {
  if (playerIndex === 0) {
    return scoreDelta > 0 ? presetIndex - 1 : presetIndex + 1;
  }

  return scoreDelta > 0 ? presetIndex + 1 : presetIndex - 1;
}
