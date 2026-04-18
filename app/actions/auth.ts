"use server";

import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { verifyUserCredentials } from "@/lib/auth/users";
import type { AuthActionState } from "@/lib/auth/auth-action-state";

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const currentUser = await getSessionUser();

  if (currentUser) {
    return {
      status: "success",
      message: "이미 로그인되어 있습니다.",
    };
  }

  const result = await verifyUserCredentials({
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  await createSession(result.user.id);

  return {
    status: "success",
    message: `${result.user.nickname}님, 다시 오신 것을 환영합니다.`,
  };
}

export async function logoutAction() {
  await destroySession();
}
