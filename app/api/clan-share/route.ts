import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/roles";
import { getServerAuthSession } from "@/lib/auth/server-auth";

const CLAN_SHARE_ENDPOINT = "https://tufelo.vercel.app/api/clan-share";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const CLAN_SHARE_MATCH_TYPES = new Set(["개인리그", "끝장전", "종족 최강전"]);

type ClanShareMatchRequest = {
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

type ClanShareMatchResult = {
  eloOk: boolean;
  index: number;
  loser: string;
  sheetError?: string;
  sheetOk: boolean;
  statusMessage: string;
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
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null);

    if (body && typeof body === "object") {
      const message = (body as { message?: unknown; error?: unknown }).message;
      const error = (body as { message?: unknown; error?: unknown }).error;

      if (typeof message === "string" && message.trim()) {
        return message;
      }

      if (typeof error === "string" && error.trim()) {
        return error;
      }
    }
  }

  const text = await response.text().catch(() => "");

  return text.trim() || fallbackMessage;
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

function getClanShareToken() {
  const token = process.env.TUF_ELO_CLAN_SHARE_TOKEN?.trim();

  if (!token) {
    throw new Error("TUF_ELO_CLAN_SHARE_TOKEN 환경 변수가 설정되지 않았습니다.");
  }

  return token;
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

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "clan-share API 호출에 실패했습니다."),
    );
  }
}

async function processClanShareMatch(
  env: SheetEnv,
  accessToken: string,
  token: string,
  match: ClanShareMatchRequest,
  index: number,
): Promise<ClanShareMatchResult> {
  let eloOk = true;
  let statusMessage = "SUCCESS";

  try {
    await submitToClanShareApi(token, match);
  } catch (error) {
    eloOk = false;
    statusMessage = normalizeResultMessage(
      error,
      "clan-share API 호출에 실패했습니다.",
    );
  }

  try {
    await appendToGoogleSheet(env, accessToken, match, statusMessage);
  } catch (error) {
    return {
      eloOk,
      index: index + 1,
      loser: match.loser,
      sheetError: normalizeResultMessage(
        error,
        "Google Sheets API 호출에 실패했습니다.",
      ),
      sheetOk: false,
      statusMessage,
      winner: match.winner,
    };
  }

  return {
    eloOk,
    index: index + 1,
    loser: match.loser,
    sheetOk: true,
    statusMessage,
    winner: match.winner,
  };
}

function buildSubmitSummary(results: ClanShareMatchResult[]) {
  const successCount = results.filter(
    (result) => result.eloOk && result.sheetOk,
  ).length;
  const failureCount = results.length - successCount;

  return {
    failureCount,
    successCount,
    total: results.length,
  };
}

function buildSheetFailureMessage(results: ClanShareMatchResult[]) {
  const failedResults = results.filter((result) => !result.sheetOk);

  if (failedResults.length === 0) {
    return null;
  }

  return failedResults
    .map(
      (result) =>
        `${result.index}번째 경기(${result.winner} vs ${result.loser}): ${
          result.sheetError ?? "Google Sheets API 호출에 실패했습니다."
        }`,
    )
    .join(" / ");
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session || !isAdminRole(session.user.role)) {
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  try {
    const matches = parseClanShareMatches(await request.json().catch(() => null));
    const env = getRequiredEnv();
    const token = getClanShareToken();
    const accessToken = await getGoogleAccessToken(env);
    const results: ClanShareMatchResult[] = [];

    for (const [index, match] of matches.entries()) {
      results.push(
        await processClanShareMatch(env, accessToken, token, match, index),
      );
    }

    const summary = buildSubmitSummary(results);
    const sheetFailureMessage = buildSheetFailureMessage(results);

    if (sheetFailureMessage) {
      return NextResponse.json(
        {
          ...summary,
          message: `Google Sheets 기록에 실패했습니다. ${sheetFailureMessage}`,
          ok: false,
          results,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...summary,
      ok: summary.failureCount === 0,
      results,
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
