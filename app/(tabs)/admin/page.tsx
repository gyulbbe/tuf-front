import type { Metadata } from "next";
import Link from "next/link";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "관리자",
};

const adminTools = [
  {
    href: "/admin/proleague",
    title: "프로리그 드래프트",
    description:
      "드래프트 세션 상태 확인, 시작/일시정지/재개, 시간 연장, 강제 스킵, 픽 권한자 지정까지 한 화면에서 처리합니다.",
  },
  {
    href: "/proleague/draft",
    title: "라이브 화면 확인",
    description:
      "실제 사용자 화면 기준으로 드래프트 진행 상태와 팀 보드를 확인합니다.",
  },
];

export default async function AdminPage() {
  const session = await requireServerAuth("/admin");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          관리자 탭과 관리자 페이지는 `ROLE_MASTER`, `ROLE_MANAGER`, `ROLE_ADMIN`
          권한 계정만 볼 수 있다.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          관리자 작업 공간
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          드래프트 운영과 검수 동선을 관리자 메뉴 아래로 모아둔다. 지금은 프로리그
          드래프트 관리 화면부터 연결해 둔 상태다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {adminTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-[28px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(236,239,232,0.86)_100%)] px-6 py-6 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)] transition-colors hover:border-accent-soft hover:bg-white"
            >
              <p className="text-lg font-semibold text-foreground">{tool.title}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{tool.description}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 정책</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <p className="rounded-[22px] bg-surface-muted px-4 py-4">
              관리자 탭은 관리자 권한 계정에게만 노출된다.
            </p>
            <p className="rounded-[22px] bg-surface-muted px-4 py-4">
              관리자 하위 메뉴의 `프로리그`에서 드래프트를 제어한다.
            </p>
            <p className="rounded-[22px] bg-surface-muted px-4 py-4">
              라이브 드래프트 화면과 관리자 제어 화면은 같은 백엔드 스냅샷을 사용한다.
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">접속 계정</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            {session.user.username} · {session.user.role}
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}
