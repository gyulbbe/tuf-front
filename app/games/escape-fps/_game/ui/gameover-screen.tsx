import type { ReactElement } from "react";
import Link from "next/link";

type GameoverScreenProps = {
  killCount: number;
  onRetry: () => void;
};

export function GameoverScreen({
  killCount,
  onRetry,
}: GameoverScreenProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/75 px-6 text-white backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-red-300/20 bg-black/80 p-7 text-center shadow-2xl">
        <h2 className="text-5xl font-black tracking-normal text-red-200">사망</h2>
        <p className="mt-4 text-white/75">처치한 적: {killCount}</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            className="h-11 rounded-md bg-red-500 px-6 font-bold text-white transition hover:bg-red-400"
            onClick={onRetry}
            type="button"
          >
            다시 시도
          </button>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/20 px-6 font-bold text-white transition hover:bg-white/10"
            href="/game"
          >
            게임 페이지
          </Link>
        </div>
      </div>
    </div>
  );
}
