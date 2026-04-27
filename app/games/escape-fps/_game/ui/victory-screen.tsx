import type { ReactElement } from "react";

type VictoryScreenProps = {
  elapsedMs: number;
  killCount: number;
  onReplay: () => void;
};

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VictoryScreen({
  elapsedMs,
  killCount,
  onReplay,
}: VictoryScreenProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-950/75 px-6 text-white backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-emerald-200/20 bg-black/80 p-7 text-center shadow-2xl">
        <h2 className="text-5xl font-black tracking-normal text-emerald-200">
          탈출 성공
        </h2>
        <p className="mt-4 text-white/75">클리어 시간: {formatTime(elapsedMs)}</p>
        <p className="mt-1 text-white/75">처치한 적: {killCount}</p>
        <button
          className="mt-7 h-11 rounded-md bg-emerald-500 px-6 font-bold text-black transition hover:bg-emerald-400"
          onClick={onReplay}
          type="button"
        >
          다시 플레이
        </button>
      </div>
    </div>
  );
}
