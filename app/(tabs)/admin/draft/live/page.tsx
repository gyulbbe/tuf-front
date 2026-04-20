import type { Metadata } from "next";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "관리자 드래프트 라이브",
};

export default function AdminDraftLivePage() {
  return (
    <div className="space-y-4">
      <SurfaceCard className="p-6">
        <p className="text-sm font-semibold text-foreground">라이브 제어 보드</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          이 탭은 드래프트 실시간 제어 전용이다. start, pause, resume, extend,
          skip, finish와 실제 픽 진행은 여기서만 처리하면 된다.
        </p>
      </SurfaceCard>
      <DraftLiveDashboard adminMode />
    </div>
  );
}
