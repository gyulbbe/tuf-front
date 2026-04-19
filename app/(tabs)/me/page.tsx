import type { Metadata } from "next";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "내정보",
};

export default function MePage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          내정보
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          계정 관련 표시는 우측 상단에만 두고, 이 페이지에서는 별도 정보를
          노출하지 않도록 정리했다.
        </p>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">안내</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            로그인한 아이디 확인과 로그아웃은 상단 오른쪽에서 바로 처리하면 된다.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}
