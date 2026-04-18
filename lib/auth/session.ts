import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/auth/users";

const SESSION_COOKIE_NAME = "tuf_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function getSessionSecret() {
  return process.env.AUTH_SECRET ?? "tuf-local-auth-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function serializeSession(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      issuedAt: Date.now(),
    }),
    "utf8",
  ).toString("base64url");
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

function parseSession(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      userId?: string;
    };

    if (!data.userId) {
      return null;
    }

    return {
      userId: data.userId,
    };
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, serializeSession(userId), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = parseSession(token);

  if (!session) {
    return null;
  }

  return getUserById(session.userId);
}
