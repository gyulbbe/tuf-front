import { redirect } from "next/navigation";
"use client";

import { FormEvent, useState } from "react";

type LoginFormState = {
  username: string;
  password: string;
};

type UserSummary = {
  userId: string;
  coin: number | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const TOKEN_STORAGE_KEY = "tuf-auth-token";
const USER_STORAGE_KEY = "tuf-login-user";

const INITIAL_FORM_STATE: LoginFormState = {
  username: "",
  password: "",
};

function formatPoint(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function readStoredUser(): UserSummary | null {
  if (typeof window === "undefined") {
    return null;
  }

  const savedUser = window.localStorage.getItem(USER_STORAGE_KEY);

  if (!savedUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(savedUser) as UserSummary;

    if (!parsed?.userId) {
      return null;
    }

    return {
      userId: parsed.userId,
      coin: typeof parsed.coin === "number" ? parsed.coin : null,
    };
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

async function fetchUserSummary(
  username: string,
  authorization: string | null,
): Promise<UserSummary> {
  const response = await fetch(
    `${API_BASE_URL}/user/get/${encodeURIComponent(username)}`,
    {
      headers: authorization
        ? {
            Authorization: authorization,
          }
        : undefined,
    },
  );

  if (!response.ok) {
    throw new Error("사용자 정보를 가져오지 못했습니다.");
  }

  const data = (await response.json()) as {
    userId?: string;
    coin?: number | null;
  };

  return {
    userId: data.userId ?? username,
    coin: typeof data.coin === "number" ? data.coin : null,
  };
}

export default function Home() {
  redirect("/notice");
  const [form, setForm] = useState<LoginFormState>(INITIAL_FORM_STATE);
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<UserSummary | null>(() => readStoredUser());

  const updateField = (key: keyof LoginFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setLoginError("");
    setForm((current) => ({
      ...current,
      password: "",
    }));
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        let errorMessage = "로그인에 실패했습니다.";

        try {
          const errorBody = (await response.json()) as { message?: string };

          if (errorBody.message) {
            errorMessage = errorBody.message;
          }
        } catch {
          // Ignore JSON parsing failures and keep the default message.
        }

        setLoginError(errorMessage);
        return;
      }

      const authorization = response.headers.get("Authorization");
      const userSummary = await fetchUserSummary(form.username, authorization);

      setUser(userSummary);
      setForm({
        username: userSummary.userId,
        password: "",
      });

      if (authorization) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, authorization);
      }

      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userSummary));
    } catch {
      setLoginError("서버에 연결하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fde68a_0%,#fff7ed_35%,#fffaf5_70%,#fffdf8_100%)] px-6 py-12 text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(120,53,15,0.08),transparent_30%,rgba(249,115,22,0.08)_100%)]" />
      <main className="relative w-full max-w-md rounded-[28px] border border-amber-200/70 bg-white/85 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-700">
            TUF
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            로그인
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            백엔드 JWT 로그인 응답에 맞춰 상태가 바뀌는 화면이다.
          </p>
        </div>

        {user ? (
          <section className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                로그인 완료
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-950">
                {user.userId}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Point
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-950">
                {formatPoint(user.coin)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              로그아웃
            </button>
          </section>
        ) : (
          <form className="space-y-4" onSubmit={handleLogin}>
            {loginError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {loginError}
              </div>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-stone-700"
              >
                아이디
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder="아이디를 입력해"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-stone-700"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                placeholder="비밀번호를 입력해"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
