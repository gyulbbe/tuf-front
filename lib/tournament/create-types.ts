import type { TournamentBracketType } from "@/lib/tournament/types";

export const TOURNAMENT_BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

export type { TournamentBracketType };

export type TournamentBestOf = (typeof TOURNAMENT_BEST_OF_OPTIONS)[number];

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

export type TournamentCreateRequest = {
  title: string;
  bracketType: TournamentBracketType;
  bestOf: TournamentBestOf;
  groups: TournamentCreateGroupRequest[];
};
