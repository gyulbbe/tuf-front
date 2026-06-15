import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/roles";
import { getServerAuthSession } from "@/lib/auth/server-auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const CLAN_SHARE_ENDPOINT = "https://tufelo.vercel.app/api/clan-share";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const CLAN_SHARE_MATCH_TYPES = new Set(["개인리그", "끝장전", "종족 최강전"]);
const SUCCESS_STATUS = "SUCCESS";
const FAILED_STATUS = "FAILED";

type ClanShareMatchRequest = {
  tournamentId: number;
  matchId: number;
  player1: string;
  player2: string;
  winner: string;
  loser: string;
  map: string;
  matchType: "개인리그" | "끝장전" | "종족 최강전";
  matchName: string;
  playedDate: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type SheetEnv = {
  clientEmail: string;
  privateKey: string;
  range: string;
  spreadsheetId: string;
};

type SheetContext =
  | {
      accessToken: string;
      env: SheetEnv;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

type TokenContext =
  | {
      ok: true;
      token: string;
    }
  | {
      error: string;
      ok: false;
    };

type ClanShareMatchResult = {
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

class ClanShareRequestError extends Error {}

function readObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  raw: Record<string, unknown>,
  key: string,
  index: number,
) {
  const value = raw[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new ClanShareRequestError(
      `${index + 1}번째 경기의 ${key} 값이 필요합니다.`,
    );
  }

  return value.trim();
}

function readOptionalString(raw: Record<string, unknown>, key: string) {
  const value = raw[key];

  return typeof value === "string" ? value.trim() : "";
}

function readRequiredId(
  raw: Record<string, unknown>,
  key: string,
  index: number,
) {
  const value = raw[key];
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
    throw new ClanShareRequestError(
      `${index + 1}번째 경기의 ${key} 값이 필요합니다.`,
    );
  }

  return numericValue;
}

function parseClanShareMatches(body: unknown): ClanShareMatchRequest[] {
  const raw = readObject(body);
  const matches = Array.isArray(raw?.matches) ? raw.matches : [];

  if (matches.length === 0) {
    throw new ClanShareRequestError("전송할 완료 경기가 없습니다.");
  }

  return matches.map((match, index) => {
    const rawMatch = readObject(match);

    if (!rawMatch) {
      throw new ClanShareRequestError(
        `${index + 1}번째 경기 데이터 형식이 올바르지 않습니다.`,
      );
    }

    const matchType = readRequiredString(rawMatch, "matchType", index);

    if (!CLAN_SHARE_MATCH_TYPES.has(matchType)) {
      throw new ClanShareRequestError(
        `${index + 1}번째 경기 유형이 올바르지 않습니다.`,
      );
    }

    return {
      tournamentId: readRequiredId(rawMatch, "tournamentId", index),
      matchId: readRequiredId(rawMatch, "matchId", index),
      player1: readRequiredString(rawMatch, "player1", index),
      player2: readRequiredString(rawMatch, "player2", index),
      winner: readRequiredString(rawMatch, "winner", index),
      loser: readRequiredString(rawMatch, "loser", index),
      map: readOptionalString(rawMatch, "map"),
      matchType: matchType as ClanShareMatchRequest["matchType"],
      matchName: readRequiredString(rawMatch, "matchName", index),
      playedDate: readRequiredString(rawMatch, "playedDate", index),
    };
  });
}

async function readApiError(response: Response, fallbackMessage: string) {
  const body = await readApiBody(response);

  return (
    readApiBodyMessage(body) ||
    (await readApiText(response)) ||
    fallbackMessage
  );
}

async function readApiBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return readObject(await response.clone().json().catch(() => null));
  }

  return null;
}

function readApiBodyMessage(body: Record<string, unknown> | null) {
  const message = body?.message;
  const error = body?.error;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return null;
}

async function readApiText(response: Response) {
  return (await response.clone().text().catch(() => "")).trim();
}

function getRequiredEnv(): SheetEnv {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const range = process.env.GOOGLE_SHEETS_RANGE?.trim();
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();

  const missing = [
    ["GOOGLE_SHEETS_SPREADSHEET_ID", spreadsheetId],
    ["GOOGLE_SHEETS_RANGE", range],
    ["GOOGLE_CLIENT_EMAIL", clientEmail],
    ["GOOGLE_PRIVATE_KEY", privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`${missing.join(", ")} 환경 변수가 설정되지 않았습니다.`);
  }

  return {
    clientEmail: clientEmail!,
    privateKey: normalizePrivateKey(privateKey!),
    range: range!,
    spreadsheetId: spreadsheetId!,
  };
}

function normalizePrivateKey(privateKey: string) {
  let normalized = privateKey.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  return normalized.replace(/\\n/g, "\n");
}

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function createServiceAccountJwt(env: SheetEnv) {
  const importedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: GOOGLE_TOKEN_ENDPOINT,
      exp: now + 3600,
      iat: now,
      iss: env.clientEmail,
      scope: GOOGLE_SHEETS_SCOPE,
    }),
  );
  const unsignedJwt = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    importedKey,
    new TextEncoder().encode(unsignedJwt),
  );

  return `${unsignedJwt}.${base64UrlEncode(signature)}`;
}

async function getGoogleAccessToken(env: SheetEnv) {
  const assertion = await createServiceAccountJwt(env);
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | GoogleTokenResponse
    | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(
      body?.error_description ||
        body?.error ||
        "Google access token 발급에 실패했습니다.",
    );
  }

  return body.access_token;
}

async function getSheetContext(): Promise<SheetContext> {
  try {
    const env = getRequiredEnv();
    return {
      accessToken: await getGoogleAccessToken(env),
      env,
      ok: true,
    };
  } catch (error) {
    return {
      error: normalizeResultMessage(
        error,
        "Google Sheets 설정 또는 인증에 실패했습니다.",
      ),
      ok: false,
    };
  }
}

function formatSheetDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return value;
  }

  return `${match[1]}.${match[2]}.${match[3]}`;
}

function formatRegisteredDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  })
    .format(new Date())
    .replace(/-/g, ".");
}

function normalizeResultMessage(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalized = message.replace(/\s+/g, " ").trim();

  return (normalized || fallbackMessage).slice(0, 500);
}

function buildSheetRow(match: ClanShareMatchRequest, statusMessage: string) {
  return [
    match.winner,
    match.loser,
    match.map,
    match.matchType,
    match.matchName,
    formatSheetDate(match.playedDate),
    formatRegisteredDate(),
    statusMessage,
  ];
}

async function readGoogleApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  return (
    body?.error?.message ||
    (await response.text().catch(() => "")) ||
    "Google Sheets API 호출에 실패했습니다."
  );
}

async function appendToGoogleSheet(
  env: SheetEnv,
  accessToken: string,
  match: ClanShareMatchRequest,
  statusMessage: string,
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.spreadsheetId}/values/${encodeURIComponent(
      env.range,
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        majorDimension: "ROWS",
        values: [buildSheetRow(match, statusMessage)],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readGoogleApiError(response));
  }
}

function getClanShareToken(): TokenContext {
  const token = process.env.TUF_ELO_CLAN_SHARE_TOKEN?.trim();

  if (!token) {
    return {
      error: "TUF_ELO_CLAN_SHARE_TOKEN 환경 변수가 설정되지 않았습니다.",
      ok: false,
    };
  }

  return {
    ok: true,
    token,
  };
}

async function submitToClanShareApi(
  token: string,
  match: ClanShareMatchRequest,
) {
  const response = await fetch(CLAN_SHARE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      player1: match.player1,
      player2: match.player2,
      winner: match.winner,
      map: match.map,
      matchType: match.matchType,
      playedDate: match.playedDate,
    }),
  });
  const body = await readApiBody(response);

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "clan-share API 호출에 실패했습니다."),
    );
  }

  if (body?.ok === false || body?.success === false) {
    throw new Error(
      readApiBodyMessage(body) || "clan-share API가 실패를 반환했습니다.",
    );
  }
}

function getLogMapName(match: ClanShareMatchRequest) {
  return match.map.trim() || "맵 미지정";
}

async function saveBackendLog(
  authorization: string,
  sendGroupId: string,
  match: ClanShareMatchRequest,
  result: Pick<
    ClanShareMatchResult,
    "eloMessage" | "eloOk" | "sheetMessage" | "sheetOk"
  >,
) {
  const response = await fetch(`${API_BASE_URL}/tournaments/clan-share-send-logs`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tournamentId: match.tournamentId,
      matchId: match.matchId,
      sendGroupId,
      player1: match.player1,
      player2: match.player2,
      winner: match.winner,
      loser: match.loser,
      mapName: getLogMapName(match),
      matchType: match.matchType,
      matchName: match.matchName,
      playedDate: match.playedDate,
      eloStatus: result.eloOk ? SUCCESS_STATUS : FAILED_STATUS,
      eloMessage: result.eloMessage,
      sheetStatus: result.sheetOk ? SUCCESS_STATUS : FAILED_STATUS,
      sheetMessage: result.sheetMessage,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "DB 전송 로그 저장에 실패했습니다."),
    );
  }
}

async function processClanShareMatch({
  authorization,
  index,
  match,
  sendGroupId,
  sheetContext,
  tokenContext,
}: {
  authorization: string;
  index: number;
  match: ClanShareMatchRequest;
  sendGroupId: string;
  sheetContext: SheetContext;
  tokenContext: TokenContext;
}): Promise<ClanShareMatchResult> {
  let eloOk = true;
  let eloMessage = SUCCESS_STATUS;
  let sheetOk = true;
  let sheetMessage = SUCCESS_STATUS;
  let logOk = true;
  let logMessage = SUCCESS_STATUS;

  if (!tokenContext.ok) {
    eloOk = false;
    eloMessage = tokenContext.error;
  } else {
    try {
      await submitToClanShareApi(tokenContext.token, match);
    } catch (error) {
      eloOk = false;
      eloMessage = normalizeResultMessage(
        error,
        "clan-share API 호출에 실패했습니다.",
      );
    }
  }

  if (!sheetContext.ok) {
    sheetOk = false;
    sheetMessage = sheetContext.error;
  } else {
    try {
      await appendToGoogleSheet(
        sheetContext.env,
        sheetContext.accessToken,
        match,
        eloMessage,
      );
    } catch (error) {
      sheetOk = false;
      sheetMessage = normalizeResultMessage(
        error,
        "Google Sheets API 호출에 실패했습니다.",
      );
    }
  }

  try {
    await saveBackendLog(authorization, sendGroupId, match, {
      eloMessage,
      eloOk,
      sheetMessage,
      sheetOk,
    });
  } catch (error) {
    logOk = false;
    logMessage = normalizeResultMessage(
      error,
      "DB 전송 로그 저장에 실패했습니다.",
    );
  }

  return {
    eloMessage,
    eloOk,
    index: index + 1,
    logMessage,
    logOk,
    loser: match.loser,
    matchId: match.matchId,
    player1: match.player1,
    player2: match.player2,
    sheetMessage,
    sheetOk,
    tournamentId: match.tournamentId,
    winner: match.winner,
  };
}

function buildSubmitSummary(results: ClanShareMatchResult[]) {
  const successCount = results.filter((result) => result.eloOk).length;
  const failureCount = results.length - successCount;
  const sheetFailureCount = results.filter((result) => !result.sheetOk).length;
  const logFailureCount = results.filter((result) => !result.logOk).length;

  return {
    failureCount,
    logFailureCount,
    sheetFailureCount,
    successCount,
    total: results.length,
  };
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session || !isAdminRole(session.user.role) || !session.authorization) {
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  try {
    const matches = parseClanShareMatches(await request.json().catch(() => null));
    const sendGroupId = crypto.randomUUID();
    const sheetContext = await getSheetContext();
    const tokenContext = getClanShareToken();
    const results: ClanShareMatchResult[] = [];

    for (const [index, match] of matches.entries()) {
      results.push(
        await processClanShareMatch({
          authorization: session.authorization,
          index,
          match,
          sendGroupId,
          sheetContext,
          tokenContext,
        }),
      );
    }

    const summary = buildSubmitSummary(results);

    return NextResponse.json({
      ...summary,
      ok: summary.failureCount === 0,
      results,
      sendGroupId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "clan-share 또는 Google Sheets 전송에 실패했습니다.",
      },
      { status: error instanceof ClanShareRequestError ? 400 : 502 },
    );
  }
}
