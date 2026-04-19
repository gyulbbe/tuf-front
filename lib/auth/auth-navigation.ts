import type { AuthRedirectReason } from "@/lib/auth/auth-types";

export function sanitizeRedirectTarget(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function getCurrentRedirectTarget() {
  if (typeof window === "undefined") {
    return null;
  }

  const current = `${window.location.pathname}${window.location.search}`;

  return sanitizeRedirectTarget(current);
}

export function buildLoginHref(options?: {
  redirectTo?: string | null;
  reason?: AuthRedirectReason | null;
}) {
  const params = new URLSearchParams();
  const redirectTo = sanitizeRedirectTarget(options?.redirectTo);

  if (redirectTo && !redirectTo.startsWith("/login")) {
    params.set("redirect", redirectTo);
  }

  if (options?.reason) {
    params.set("reason", options.reason);
  }

  const query = params.toString();

  return query ? `/login?${query}` : "/login";
}
