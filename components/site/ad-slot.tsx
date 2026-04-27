import { cn } from "@/lib/utils";

type AdSlotProps = {
  className?: string;
  slotId: string;
  title?: string;
};

export function AdSlot({ className, slotId }: AdSlotProps) {
  return (
    <aside
      data-ad-slot={slotId}
      className={cn(
        "rounded-[24px] border border-dashed border-line bg-surface px-4 py-4 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl",
        className,
      )}
    >
      {/* Reserved ad mount point. Real ad scripts can target data-ad-slot. */}
      <div className="min-h-[96px] rounded-[20px] bg-surface-strong" />
    </aside>
  );
}
