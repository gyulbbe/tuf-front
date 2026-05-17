import type { Metadata } from "next";
import Link from "next/link";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "게임",
};

export default function GamesPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <SurfaceCard className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Games
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            게임
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
            TuF에서 바로 실행할 수 있는 게임과 실험 기능을 모아둔 공간입니다.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <Link
              href="/games/escape-fps"
              className="group rounded-lg border border-line bg-white px-6 py-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)] transition-colors hover:border-accent hover:bg-accent-soft/40"
            >
              <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink">
                FPS
              </span>
              <h2 className="mt-4 text-xl font-bold text-foreground group-hover:text-accent-ink">
                방탈출
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                별도 게임 화면에서 실행되는 FPS 방탈출 데모입니다.
              </p>
            </Link>
          </div>
        </SurfaceCard>
      </div>
    </main>
  );
}
