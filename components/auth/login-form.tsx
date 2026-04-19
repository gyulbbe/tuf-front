"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { useAuth } from "@/components/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { sanitizeRedirectTarget } from "@/lib/auth/auth-navigation";
import type { AuthRedirectReason } from "@/lib/auth/auth-types";

const INITIAL_FORM = {
  username: "",
  password: "",
};

const reasonMessages: Partial<Record<AuthRedirectReason, string>> = {
  "login-required": "로그인이 필요한 페이지입니다.",
  "session-expired": "세션이 만료돼 다시 로그인해야 합니다.",
  unauthorized: "인증이 만료돼 다시 로그인해야 합니다.",
};

type LoginFormProps = {
  redirectTo?: string | null;
  reason?: string | null;
  onSuccess?: () => void;
  showReturnLink?: boolean;
};

function validateForm(form: typeof INITIAL_FORM) {
  const username = form.username.trim();
  const password = form.password.trim();

  if (!username) {
    return "아이디를 입력해 주세요.";
  }

  if (username.length < 3) {
    return "아이디는 3자 이상 입력해 주세요.";
  }

  if (!password) {
    return "비밀번호를 입력해 주세요.";
  }

  return null;
}

export function LoginForm({
  redirectTo,
  reason,
  onSuccess,
  showReturnLink = true,
}: LoginFormProps) {
  const router = useRouter();
  const { login, isAuthenticated, status } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fallbackRedirect = sanitizeRedirectTarget(redirectTo) ?? "/notice";
  const reasonMessage =
    typeof reason === "string"
      ? (reasonMessages[reason as AuthRedirectReason] ?? null)
      : null;

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    startTransition(() => {
      router.replace(fallbackRedirect);
    });
  }, [fallbackRedirect, router, status]);

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();

        const validationError = validateForm(form);

        if (validationError) {
          setError(validationError);
          return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
          await login({
            username: form.username.trim(),
            password: form.password,
          });

          onSuccess?.();

          startTransition(() => {
            router.replace(fallbackRedirect);
          });
        } catch (loginError) {
          setError(
            loginError instanceof Error
              ? loginError.message
              : "로그인 처리 중 오류가 발생했습니다.",
          );
        } finally {
          setIsSubmitting(false);
          setForm((current) => ({
            ...current,
            password: "",
          }));
        }
      }}
    >
      {error ? (
        <p
          aria-live="polite"
          className="rounded-2xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-ink"
        >
          {error}
        </p>
      ) : reasonMessage && !isAuthenticated ? (
        <p
          aria-live="polite"
          className="rounded-2xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-ink"
        >
          {reasonMessage}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">
          아이디
        </span>
        <Input
          required
          minLength={3}
          maxLength={50}
          name="username"
          autoComplete="username"
          value={form.username}
          onChange={(event) => {
            setForm((current) => ({
              ...current,
              username: event.target.value,
            }));
          }}
          placeholder="아이디 입력"
          aria-invalid={Boolean(error)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">
          비밀번호
        </span>
        <Input
          required
          minLength={1}
          maxLength={100}
          type="password"
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => {
            setForm((current) => ({
              ...current,
              password: event.target.value,
            }));
          }}
          placeholder="비밀번호 입력"
          aria-invalid={Boolean(error)}
        />
      </label>

      <AuthSubmitButton
        idleText="로그인"
        pendingText="로그인 중..."
        pending={isSubmitting}
      />

      {showReturnLink ? (
        <div className="pt-2 text-sm text-muted">
          <Link
            href="/notice"
            className="transition-colors hover:text-foreground"
          >
            공지사항으로 돌아가기
          </Link>
        </div>
      ) : null}
    </form>
  );
}
