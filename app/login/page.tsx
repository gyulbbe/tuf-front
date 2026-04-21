import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SurfaceCard } from "@/components/site/surface-card";
import { getServerAuthSession } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "로그인",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFirstValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerAuthSession();
  const resolvedSearchParams = await searchParams;

  if (session) {
    redirect("/gallery");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <SurfaceCard className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Auth
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            로그인
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
            백엔드 `/login` 응답 헤더의 `Authorization` 값을 읽어 JWT를 저장하고,
            이후 요청에는 자동으로 `Bearer` 헤더를 붙이는 흐름으로 맞췄다.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">계정 접속</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            아이디와 비밀번호를 입력하면 2시간짜리 JWT를 저장하고, 만료되거나
            401이 오면 자동으로 로그아웃된다.
          </p>
          <LoginForm
            redirectTo={readFirstValue(resolvedSearchParams.redirect)}
            reason={readFirstValue(resolvedSearchParams.reason)}
          />
        </SurfaceCard>
      </div>
    </div>
  );
}
