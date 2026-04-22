import Link from "next/link";
import type { Metadata } from "next";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";

const entryCardClassName =
  "rounded-[26px] border border-line bg-surface-strong p-5 transition-colors";

export const metadata: Metadata = {
  title: "컨텐츠 드래프트",
};

export default async function DraftPage() {
  await requireServerAuth("/draft");

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Draft
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            드래프트
          </h1>
          <p className="mt-4 text-base leading-8 text-muted">
            기존 컨텐츠 드래프트와 가위바위보 팀 정하기를 여기서 나눠서 들어갈 수 있습니다.
          </p>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <div className={entryCardClassName}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                현재 화면
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              기존 드래프트
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              기존 컨텐츠 드래프트는 아래 화면에서 바로 이어서 진행하면 됩니다.
            </p>
          </div>

          <Link
            href="/draft/rps"
            className={`${entryCardClassName} hover:border-accent-soft hover:bg-white`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                새 흐름
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              가위바위보 팀 정하기
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              세션을 만들고 팀장 2명과 후보를 정한 뒤, 가위바위보로 선픽과 후픽을 반복합니다.
            </p>
            <p className="mt-4 text-sm font-semibold text-accent">들어가기</p>
          </Link>
        </div>
      </SurfaceCard>

      <DraftLiveDashboard variant="content" />
    </div>
  );
}
