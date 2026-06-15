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
