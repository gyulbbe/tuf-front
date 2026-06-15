export type TournamentStatus = "LIVE" | "FINISHED";

export type TournamentBracketType =
  | "SINGLE_ELIMINATION"
  | "DUAL_GROUP"
  | "ULTIMATE_BATTLE"
  | "RACE_SURVIVAL";

export type TournamentMatchStatus =
  | "PENDING"
  | "READY"
  | "FINISHED"
  | "CANCELLED";

export type TournamentMatchRole =
  | "OPENING"
  | "WINNERS"
  | "LOSERS"
  | "DECIDER"
  | "ROUND"
  | "FINAL";

export type TournamentGroupCode = "A" | "B" | (string & {});

export type TournamentMatchKey =
  | "A1"
  | "A2"
  | "AW"
  | "AL"
  | "AF"
  | "B1"
  | "B2"
  | "BW"
  | "BL"
  | "BF"
  | (string & {});

export type TournamentSlotOutcome = "WIN" | "LOSS";

export type TournamentResultType = "GROUP_WINNER" | "GROUP_RUNNER_UP";

export type TournamentParticipant = {
  id: string;
  userId: string | null;
  userLoginId?: string | null;
  participantName?: string | null;
  displayName: string;
  seedLabel: string;
  color: string;
  status?: string | null;
};

export type TournamentMatchSlot = {
  slotNo: number;
  participant: TournamentParticipant | null;
  placeholderLabel?: string | null;
  score: number | null;
  isWinner: boolean;
  isBye: boolean;
  sourceMatchId?: string;
  sourceOutcome?: TournamentSlotOutcome;
};

export type TournamentMatchSetResult = {
  setNo: number;
  mapId: number | null;
  mapName: string | null;
  winnerSlotNo: 1 | 2 | null;
};

export type TournamentMatch = {
  id: string;
  matchKey: TournamentMatchKey;
  matchRole: TournamentMatchRole;
  displayName: string;
  bestOf: number;
  status: TournamentMatchStatus;
  mapId: number | null;
  mapName: string | null;
  setResults: TournamentMatchSetResult[];
  scheduledAt: string | null;
  slots: TournamentMatchSlot[];
  layoutCol: number;
  layoutRow: number;
  displayOrder: number;
};

export type TournamentResultSlot = {
  resultKey: string;
  resultType: TournamentResultType;
  rankNo: number;
  label: string;
  participant?: TournamentParticipant | null;
};

export type TournamentConnectorSegment = {
  orientation: "HORIZONTAL" | "VERTICAL";
  x: number;
  y: number;
  length: number;
};

export type TournamentParticipantConnector = {
  participantId: string;
  segments: TournamentConnectorSegment[];
};

export type TournamentGroup = {
  id: string;
  groupCode: TournamentGroupCode;
  groupName: string;
  description: string;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  resultSlots: TournamentResultSlot[];
  connectors?: TournamentParticipantConnector[];
};

export type Tournament = {
  id: string;
  title: string;
  bracketType: TournamentBracketType | null;
  status: TournamentStatus;
  groups: TournamentGroup[];
};

export type TournamentSummary = {
  id: string;
  title: string;
  bracketType: TournamentBracketType | null;
  status: TournamentStatus;
  groupCount: number;
  participantCount: number;
  regDate?: string | null;
  updateDate?: string | null;
};

export type TournamentPage = {
  items: TournamentSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};
