import { cn } from "@/lib/utils";

type AdSlotProps = {
  className?: string;
  slotId: string;
  title?: string;
};

export function AdSlot({ className, slotId, title = "AD SPACE" }: AdSlotProps) {
  return (
    <aside
      data-ad-slot={slotId}
      className={cn(
        "rounded-[24px] border border-dashed border-line bg-surface px-4 py-4 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex min-h-[96px] flex-col items-center justify-center rounded-[20px] bg-surface-strong px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {title}
        </p>
        <p className="mt-3 text-sm font-medium text-foreground">
          Google AdSense / Kakao AdFit
        </p>
        <p className="mt-2 text-xs leading-6 text-muted">
          광고 스크립트와 발급 ID를 연결하면 이 영역에 바로 붙일 수 있습니다.
        </p>
      </div>
    </aside>
  );
}
