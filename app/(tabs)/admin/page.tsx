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
    href: "/admin/draft",
    title: "드래프트 관리",
    description: "프로리그 드래프트와 팀배/컨텐츠 드래프트 등록, 수정, 운영을 관리합니다.",
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
          관리자 메뉴와 관리자 페이지는 `ROLE_MASTER`, `ROLE_MANAGER`, `ROLE_ADMIN`
          권한 계정만 볼 수 있다.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="p-7 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        Admin
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        관리자 작업 공간
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
        필요한 관리 화면만 남겨서 드래프트 운영 동선을 단순화했다.
      </p>

      <div className="mt-8 grid gap-4 md:max-w-xl">
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
  );
}
