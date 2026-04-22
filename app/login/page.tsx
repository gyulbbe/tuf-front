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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <SurfaceCard className="p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            로그인
          </h1>
          <LoginForm
            redirectTo={readFirstValue(resolvedSearchParams.redirect)}
            reason={readFirstValue(resolvedSearchParams.reason)}
          />
        </SurfaceCard>
      </div>
    </div>
  );
}
