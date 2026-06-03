import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/roles";
import { getServerAuthSession } from "@/lib/auth/server-auth";

const CLAN_SHARE_ENDPOINT = "https://tufelo.vercel.app/api/clan-share";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const TEST_CLAN_SHARE_PAYLOAD = {
  player1: "test계정1",
  player2: "test계정2",
  winner: "test계정1",
  map: "투혼",
  matchType: "개인리그",
  playedDate: "2026-05-31",
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

function getLoserName() {
  const { player1, player2, winner } = TEST_CLAN_SHARE_PAYLOAD;

  if (winner === player1) {
    return player2;
  }

  if (winner === player2) {
    return player1;
  }

  return player1;
}

function buildSheetRow() {
  return [
    TEST_CLAN_SHARE_PAYLOAD.winner,
    getLoserName(),
    TEST_CLAN_SHARE_PAYLOAD.map,
    TEST_CLAN_SHARE_PAYLOAD.matchType,
    "",
    formatSheetDate(TEST_CLAN_SHARE_PAYLOAD.playedDate),
    formatRegisteredDate(),
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

async function appendToGoogleSheet(env: SheetEnv) {
  const accessToken = await getGoogleAccessToken(env);
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
        values: [buildSheetRow()],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readGoogleApiError(response));
  }
}

async function submitToClanShareApi() {
  const token = process.env.TUF_ELO_CLAN_SHARE_TOKEN?.trim();

  if (!token) {
    throw new Error("TUF_ELO_CLAN_SHARE_TOKEN 환경 변수가 설정되지 않았습니다.");
  }

  const response = await fetch(CLAN_SHARE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(TEST_CLAN_SHARE_PAYLOAD),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "clan-share API 호출에 실패했습니다."),
    );
  }
}

export async function POST() {
  const session = await getServerAuthSession();

  if (!session || !isAdminRole(session.user.role)) {
    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  try {
    await submitToClanShareApi();
    await appendToGoogleSheet(getRequiredEnv());

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "clan-share 또는 Google Sheets 전송에 실패했습니다.",
      },
      { status: 502 },
    );
  }
}
