"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type OverlayDialogProps = {
  children: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  description?: string;
  onClose: () => void;
  open: boolean;
  panelClassName?: string;
  title: string;
};

export function OverlayDialog({
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  description,
  onClose,
  open,
  panelClassName,
  title,
}: OverlayDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/28 px-3 py-3 backdrop-blur-[2px] sm:px-6 sm:py-6"
      onClick={() => {
        if (closeOnBackdropClick) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-lg border border-line bg-surface p-6 shadow-[0_16px_50px_rgba(23,33,43,0.12)] sm:max-h-[calc(100dvh-3rem)]",
          panelClassName || "max-w-lg",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/80 pb-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="닫기"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-xl font-semibold leading-none text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="mt-5 overflow-y-auto pr-1 sm:pr-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
