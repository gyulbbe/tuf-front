import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import { AUTH_COOKIE_NAME, parseAuthCookieValue } from "@/lib/auth/auth-cookie";

export async function getServerAuthSession() {
  const cookieStore = await cookies();

  return parseAuthCookieValue(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);
}

export async function requireServerAuth(redirectTo: string) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;

  if (!cookieValue) {
    redirect(
      buildLoginHref({
        reason: "login-required",
        redirectTo,
      }),
    );
  }

  const session = parseAuthCookieValue(cookieValue);

  if (!session) {
    redirect(
      buildLoginHref({
        reason: "session-expired",
        redirectTo,
      }),
    );
  }

  return session;
}
