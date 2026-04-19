import type { AuthSession } from "@/lib/auth/auth-types";
import { buildAuthSession, isExpiredExp } from "@/lib/auth/jwt";

export const AUTH_COOKIE_NAME = "tuf-auth";

function encodeCookieValue(value: string) {
  return encodeURIComponent(value);
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function buildSecureFlag() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function writeAuthCookie(session: AuthSession) {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = Math.max(session.user.exp - Math.floor(Date.now() / 1000), 0);

  document.cookie = [
    `${AUTH_COOKIE_NAME}=${encodeCookieValue(session.authorization)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    buildSecureFlag(),
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    buildSecureFlag(),
  ]
    .filter(Boolean)
    .join("; ");
}

export function parseAuthCookieValue(value?: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  const authorization = decodeCookieValue(value);

  if (!authorization) {
    return null;
  }

  const session = buildAuthSession(authorization);

  if (!session || isExpiredExp(session.user.exp)) {
    return null;
  }

  return session;
}
