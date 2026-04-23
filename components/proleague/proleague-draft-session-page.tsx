"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DraftAdminConsole } from "@/components/proleague/draft-admin-console";
import { SurfaceCard } from "@/components/site/surface-card";
import {
  proleagueDraftListPath,
  proleagueDraftLivePath,
} from "@/lib/proleague-draft/routes";

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink";

export function ProleagueDraftSessionPage({ sessionId }: { sessionId: number }) {
  const router = useRouter();

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              프로리그 드래프트 설정
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              드래프트 생성과 목록 선택은 랜딩에서 처리하고, 이 화면에서는 선택한 드래프트 한
              건만 설정합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={proleagueDraftListPath()} className={secondaryLinkClassName}>
              목록
            </Link>
            <Link href={proleagueDraftLivePath(sessionId)} className={primaryLinkClassName}>
              라이브/관전
            </Link>
          </div>
        </div>
      </SurfaceCard>

      <DraftAdminConsole
        sessionId={sessionId}
        onSessionDeleted={() => {
          router.replace(proleagueDraftListPath());
        }}
      />
    </div>
  );
}
