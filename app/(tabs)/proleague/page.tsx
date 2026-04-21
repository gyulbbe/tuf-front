import type { Metadata } from "next";
import Link from "next/link";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "프로리그",
};

export default async function ProleaguePage() {
  await requireServerAuth("/proleague");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Proleague
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          프로리그 허브
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          드래프트 탭을 프로리그 밖으로 분리했다. 프로리그 전용 드래프트는 아래 카드로
          바로 들어가면 된다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/proleague/draft"
            className="rounded-[28px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(236,239,232,0.86)_100%)] px-6 py-6 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)] transition-colors hover:border-accent-soft hover:bg-white"
          >
            <p className="text-lg font-semibold text-foreground">프로리그 드래프트</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              기존 고정 순서 기반 프로리그 드래프트 화면으로 이동한다.
            </p>
          </Link>

          <Link
            href="/draft"
            className="rounded-[28px] border border-line bg-surface-strong px-6 py-6 transition-colors hover:border-accent-soft hover:bg-white"
          >
            <p className="text-lg font-semibold text-foreground">팀배/컨텐츠 드래프트</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              프로리그 밖에서 쓰는 새 드래프트 화면으로 이동한다.
            </p>
          </Link>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <p className="text-sm font-semibold text-foreground">정리</p>
        <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
          <p className="rounded-[22px] bg-surface-muted px-4 py-4">
            상단 탭에 별도 `드래프트`가 생겼고, 기본 화면은 팀배/컨텐츠 드래프트다.
          </p>
          <p className="rounded-[22px] bg-surface-muted px-4 py-4">
            프로리그 쪽 기존 화면은 `프로리그 드래프트`라는 이름으로 유지한다.
          </p>
        </div>
      </SurfaceCard>
    </div>
  );
}
