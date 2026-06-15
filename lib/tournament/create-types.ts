import type {
  TournamentBracketType,
  TournamentMatchRole,
} from "@/lib/tournament/types";

export const DEFAULT_TOURNAMENT_BEST_OF = 3;
export const MIN_TOURNAMENT_BEST_OF = 1;

export type { TournamentBracketType };

export type TournamentBestOf = number;

export function isValidTournamentBestOf(value: number) {
  return (
    Number.isInteger(value) &&
    value >= MIN_TOURNAMENT_BEST_OF &&
    value % 2 === 1
  );
}

export function normalizeTournamentBestOf(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_TOURNAMENT_BEST_OF;
  }

  const rounded = Math.max(MIN_TOURNAMENT_BEST_OF, Math.round(value));
  return rounded % 2 === 1 ? rounded : rounded + 1;
}

export type TournamentCreateSlotRequest = {
  slotNo: number;
  userId?: number | null;
  participantName?: string | null;
};

export type TournamentCreateGroupRequest = {
  groupCode: string;
  groupName: string;
  slots: TournamentCreateSlotRequest[];
};

export type TournamentCreateMapDefaultTarget = "ROUND" | "MATCH_ROLE";

export type TournamentCreateMapDefaultRole = Extract<
  TournamentMatchRole,
  "OPENING" | "WINNERS" | "LOSERS" | "DECIDER" | "FINAL"
>;

export type TournamentCreateMapDefaultRequest = {
  target: TournamentCreateMapDefaultTarget;
  roundNo?: number;
  matchRole?: TournamentCreateMapDefaultRole;
  mapId: number;
};

export type TournamentCreateMatchDefaultRole = Extract<
  TournamentMatchRole,
  "OPENING" | "WINNERS" | "LOSERS" | "DECIDER" | "FINAL"
>;

export type TournamentCreateMatchDefaultRequest = {
  target: TournamentCreateMapDefaultTarget;
  roundNo?: number;
  matchRole?: TournamentCreateMatchDefaultRole;
  bestOf?: number;
  mapIds?: Array<number | null>;
};

export type TournamentCreateRequest = {
  title: string;
  bracketType: TournamentBracketType;
  bestOf: TournamentBestOf;
  groups: TournamentCreateGroupRequest[];
  mapDefaults?: TournamentCreateMapDefaultRequest[];
  matchDefaults?: TournamentCreateMatchDefaultRequest[];
};
