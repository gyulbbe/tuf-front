import type { Metadata } from "next";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "관리자 팀배/컨텐츠 드래프트 라이브",
};

export default function AdminDraftLivePage() {
  return (
    <div className="space-y-4">
      <SurfaceCard className="p-6">
        <p className="text-sm font-semibold text-foreground">라이브 제어 보드</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          이 탭은 팀배/컨텐츠 드래프트 실시간 제어 전용이다. start, pause, resume,
          next-picker, skip, finish와 실제 픽 진행을 여기서 확인하면 된다. 고정 순서
          세션일 때만 타이머 연장 UI가 같이 열린다.
        </p>
      </SurfaceCard>
      <DraftLiveDashboard adminMode variant="content" />
    </div>
  );
}
