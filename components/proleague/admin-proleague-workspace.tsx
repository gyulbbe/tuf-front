"use client";

import { useState } from "react";
import { DraftAdminConsole } from "@/components/proleague/draft-admin-console";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { SurfaceCard } from "@/components/site/surface-card";

export function AdminProleagueWorkspace() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="space-y-4">
      <DraftAdminConsole
        onDataChanged={() => {
          setRefreshSignal((current) => current + 1);
        }}
      />
      <SurfaceCard className="p-6">
        <p className="text-sm font-semibold text-foreground">라이브 제어 보드</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          위 콘솔은 세션 / 팀 / 픽커 / 후보 / 순서 / 픽 기록을 준비하고 보정하는
          영역이다. 아래 라이브 보드는 start, pause, resume, extend, skip, finish와
          실제 픽 진행을 담당한다.
        </p>
      </SurfaceCard>
      <DraftLiveDashboard refreshSignal={refreshSignal} />
    </div>
  );
}
