import type { AuthSession, AuthUser, JwtClaims } from "@/lib/auth/auth-types";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const withPadding =
    padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(withPadding);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(withPadding, "base64").toString("utf8");
}

export function extractBearerToken(authorization: string) {
  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export function decodeJwtClaims(authorization: string): JwtClaims | null {
  const token = extractBearerToken(authorization);

  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Partial<JwtClaims>;

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return {
      username: parsed.username,
      role: parsed.role,
      photo: typeof parsed.photo === "string" ? parsed.photo : null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function isExpiredExp(exp: number) {
  return exp * 1000 <= Date.now();
}

export function buildAuthSession(authorization: string): AuthSession | null {
  const claims = decodeJwtClaims(authorization);

  if (!claims) {
    return null;
  }

  const user: AuthUser = {
    username: claims.username,
    role: claims.role,
    photo: claims.photo ?? null,
    exp: claims.exp,
  };

  return {
    authorization,
    user,
  };
}
