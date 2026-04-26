import type { ReactElement } from "react";

type PauseScreenProps = {
  onResume: () => void;
  onTitle: () => void;
};

export function PauseScreen({ onResume, onTitle }: PauseScreenProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6 text-white backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-white/15 bg-black/80 p-6 text-center shadow-2xl">
        <h2 className="text-3xl font-black tracking-normal">일시정지</h2>
        <div className="mt-6 grid gap-3">
          <button
            className="h-11 rounded-md bg-white px-4 font-bold text-black transition hover:bg-white/85"
            onClick={onResume}
            type="button"
          >
            계속
          </button>
          <button
            className="h-11 rounded-md border border-white/20 px-4 font-semibold text-white transition hover:bg-white/10"
            onClick={onTitle}
            type="button"
          >
            타이틀로
          </button>
        </div>
      </div>
    </div>
  );
}
