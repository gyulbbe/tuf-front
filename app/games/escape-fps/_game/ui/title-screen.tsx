import type { ReactElement } from "react";
import { useState } from "react";
import type { GamePhase } from "../state/game";

type TitleScreenProps = {
  onStart: () => void;
  phase: Extract<GamePhase, "loading" | "title">;
};

export function TitleScreen({ onStart, phase }: TitleScreenProps): ReactElement {
  const [showControls, setShowControls] = useState(false);
  const isLoading = phase === "loading";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-zinc-950 via-red-950/80 to-black px-6 text-white">
      <div className="w-full max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-200/70">
          Escape FPS
        </p>
        <h1 className="mt-3 text-6xl font-black tracking-normal text-white">
          ESCAPE
        </h1>
        <p className="mt-3 text-lg text-white/72">감염된 시설에서 탈출하라.</p>

        <button
          className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-red-500 px-7 text-base font-bold text-white transition hover:bg-red-400 disabled:cursor-wait disabled:bg-red-500/55"
          disabled={isLoading}
          onClick={onStart}
          type="button"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              게임 시작 중...
            </span>
          ) : (
            "게임 시작하기"
          )}
        </button>

        <button
          className="mt-8 h-10 rounded-md border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          onClick={() => setShowControls((value) => !value)}
          type="button"
        >
          조작법 {showControls ? "닫기" : "보기"}
        </button>

        {showControls && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/70">
            <p>W/S 이동, A/D 스트레이프, Shift 달리기, 마우스 시점</p>
            <p>좌클릭 발사, 우클릭 조준, R 재장전, 1-3 무기 전환</p>
            <p>ESC 또는 P 일시정지</p>
          </div>
        )}
      </div>
    </div>
  );
}
