import axios from "axios";
import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  data?: T | null;
  message?: string;
  status?: number;
};

type ErrorResponseBody = {
  error?: string;
  message?: string;
};

type ClanShareResponseBody = {
  failureCount?: number;
  logFailureCount?: number;
  message?: string;
  ok?: boolean;
  results?: ClanShareMatchResult[];
  sendGroupId?: string;
  sheetFailureCount?: number;
  successCount?: number;
  total?: number;
};

export type ClanShareMatchPayload = {
  tournamentId: string;
  matchId: string;
  player1: string;
  player2: string;
  winner: string;
  loser: string;
  map: string;
  matchType: "개인리그" | "끝장전" | "종족 최강전";
  matchName: string;
  playedDate: string;
  setNo?: number;
};

export type ClanShareMatchResult = {
  eloMessage: string;
  eloOk: boolean;
  index: number;
  logMessage: string;
  logOk: boolean;
  loser: string;
  matchId: number;
  player1: string;
  player2: string;
  setNo: number | null;
  sheetMessage: string;
  sheetOk: boolean;
  tournamentId: number;
  winner: string;
};

export type ClanShareSubmitResult = {
  failureCount: number;
  logFailureCount: number;
  ok: boolean;
  results: ClanShareMatchResult[];
  sendGroupId: string | null;
  sheetFailureCount: number;
  successCount: number;
  total: number;
};

export type ClanShareLogSummary = {
  hasHistory: boolean;
  latestSentAt: string | null;
  totalCount: number;
};

export type ClanShareMatchSendStatus = "SUCCESS" | "FAILED" | "UNSENT";

export type ClanShareRoundStatusSet = {
  setNo: number;
  status: ClanShareMatchSendStatus;
  eloMessage: string | null;
  sheetStatus: "SUCCESS" | "FAILED" | null;
  sheetMessage: string | null;
  latestSentAt: string | null;
  retryable: boolean;
};

export type ClanShareRoundStatusMatch = {
  matchId: string;
  player1: string;
  player2: string;
  winner: string;
  mapName: string;
  status: ClanShareMatchSendStatus;
  eloMessage: string | null;
  sheetStatus: "SUCCESS" | "FAILED" | null;
  sheetMessage: string | null;
  latestSentAt: string | null;
  retryable: boolean;
  sets: ClanShareRoundStatusSet[];
};

export type ClanShareRoundStatusGroup = {
  groupKey: string;
  groupLabel: string;
  matches: ClanShareRoundStatusMatch[];
};

export type ClanShareRoundStatusTotals = {
  total: number;
  success: number;
  failed: number;
  unsent: number;
  sheetFailed: number;
  retryable: number;
};

export type ClanShareRoundStatus = {
  groups: ClanShareRoundStatusGroup[];
  totals: ClanShareRoundStatusTotals;
};

function readObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readErrorMessage(data: unknown, fallback: string) {
  const body = readObject(data);

  return readString(body.message) || readString(body.error) || fallback;
}

function normalizeMatchResult(value: unknown): ClanShareMatchResult {
  const raw = readObject(value);

  return {
    eloMessage: readString(raw.eloMessage, ""),
    eloOk: readBoolean(raw.eloOk),
    index: readNumber(raw.index),
    logMessage: readString(raw.logMessage, ""),
    logOk: readBoolean(raw.logOk),
    loser: readString(raw.loser),
    matchId: readNumber(raw.matchId),
    player1: readString(raw.player1),
    player2: readString(raw.player2),
    setNo: readNumber(raw.setNo) || null,
    sheetMessage: readString(raw.sheetMessage, ""),
    sheetOk: readBoolean(raw.sheetOk),
    tournamentId: readNumber(raw.tournamentId),
    winner: readString(raw.winner),
  };
}

async function readResponseBody(response: Response) {
  return (await response.json().catch(() => null)) as
    | ClanShareResponseBody
    | null;
}

function toSubmitResult(body: ClanShareResponseBody | null): ClanShareSubmitResult {
  const results = Array.isArray(body?.results)
    ? body.results.map(normalizeMatchResult)
    : [];

  return {
    failureCount: body?.failureCount ?? 0,
    logFailureCount: body?.logFailureCount ?? 0,
    ok: body?.ok ?? true,
    results,
    sendGroupId: body?.sendGroupId ?? null,
    sheetFailureCount: body?.sheetFailureCount ?? 0,
    successCount: body?.successCount ?? 0,
    total: body?.total ?? results.length,
  };
}

function normalizeLogSummary(value: unknown): ClanShareLogSummary {
  const raw = readObject(value);

  return {
    hasHistory: readBoolean(raw.hasHistory),
    latestSentAt: readString(raw.latestSentAt) || null,
    totalCount: readNumber(raw.totalCount),
  };
}

function normalizeSendStatus(value: unknown): ClanShareMatchSendStatus {
  switch (value) {
    case "SUCCESS":
    case "FAILED":
      return value;
    case "UNSENT":
    default:
      return "UNSENT";
  }
}

function normalizeSheetStatus(value: unknown): "SUCCESS" | "FAILED" | null {
  switch (value) {
    case "SUCCESS":
    case "FAILED":
      return value;
    default:
      return null;
  }
}

function normalizeRoundStatusMatch(value: unknown): ClanShareRoundStatusMatch {
  const raw = readObject(value);

  return {
    matchId: readString(raw.matchId, String(readNumber(raw.matchId))),
    player1: readString(raw.player1),
    player2: readString(raw.player2),
    winner: readString(raw.winner),
    mapName: readString(raw.mapName),
    status: normalizeSendStatus(raw.status),
    eloMessage: readString(raw.eloMessage) || null,
    sheetStatus: normalizeSheetStatus(raw.sheetStatus),
    sheetMessage: readString(raw.sheetMessage) || null,
    latestSentAt: readString(raw.latestSentAt) || null,
    retryable: readBoolean(raw.retryable),
    sets: Array.isArray(raw.sets)
      ? raw.sets.map(normalizeRoundStatusSet)
      : [],
  };
}

function normalizeRoundStatusSet(value: unknown): ClanShareRoundStatusSet {
  const raw = readObject(value);

  return {
    setNo: readNumber(raw.setNo),
    status: normalizeSendStatus(raw.status),
    eloMessage: readString(raw.eloMessage) || null,
    sheetStatus: normalizeSheetStatus(raw.sheetStatus),
    sheetMessage: readString(raw.sheetMessage) || null,
    latestSentAt: readString(raw.latestSentAt) || null,
    retryable: readBoolean(raw.retryable),
  };
}

function normalizeRoundStatusGroup(value: unknown): ClanShareRoundStatusGroup {
  const raw = readObject(value);

  return {
    groupKey: readString(raw.groupKey),
    groupLabel: readString(raw.groupLabel),
    matches: Array.isArray(raw.matches)
      ? raw.matches.map(normalizeRoundStatusMatch)
      : [],
  };
}

function normalizeRoundStatusTotals(value: unknown): ClanShareRoundStatusTotals {
  const raw = readObject(value);

  return {
    total: readNumber(raw.total),
    success: readNumber(raw.success),
    failed: readNumber(raw.failed),
    unsent: readNumber(raw.unsent),
    sheetFailed: readNumber(raw.sheetFailed),
    retryable: readNumber(raw.retryable),
  };
}

function normalizeRoundStatus(value: unknown): ClanShareRoundStatus {
  const raw = readObject(value);

  return {
    groups: Array.isArray(raw.groups)
      ? raw.groups.map(normalizeRoundStatusGroup)
      : [],
    totals: normalizeRoundStatusTotals(raw.totals),
  };
}

async function unwrapBackendPayload<T>(
  request: Promise<{
    data: ApiEnvelope<T> | ErrorResponseBody | T;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const bodyObject = readObject(response.data);
    const responseStatus =
      typeof bodyObject.status === "number" ? bodyObject.status : response.status;
    const responseMessage = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(responseMessage);
    }

    if (responseStatus < 200 || responseStatus >= 300) {
      throw new Error(responseMessage);
    }

    if ("data" in bodyObject) {
      return bodyObject.data as T;
    }

    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        readErrorMessage(error.response?.data, error.message || fallback),
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(fallback);
  }
}

export async function getClanShareLogSummary(tournamentId: string) {
  const response = await unwrapBackendPayload<unknown>(
    apiClient.get<ApiEnvelope<unknown> | unknown>(
      `/tournaments/${tournamentId}/clan-share-send-logs/summary`,
      {
        validateStatus: () => true,
      },
    ),
    "ELO/시트 연동 이력을 확인하지 못했습니다.",
  );

  return normalizeLogSummary(response);
}

export async function getClanShareRoundStatus(tournamentId: string) {
  const response = await unwrapBackendPayload<unknown>(
    apiClient.get<ApiEnvelope<unknown> | unknown>(
      `/tournaments/${tournamentId}/clan-share-send-logs/status`,
      {
        validateStatus: () => true,
      },
    ),
    "ELO/시트 전송 상태를 불러오지 못했습니다.",
  );

  return normalizeRoundStatus(response);
}

export async function submitClanShareMatches(matches: ClanShareMatchPayload[]) {
  const response = await fetch("/api/clan-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ matches }),
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(body?.message || "clan-share 전송에 실패했습니다.");
  }

  return toSubmitResult(body);
}
