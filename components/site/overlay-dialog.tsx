"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
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
      data-overlay-dialog-root="true"
      data-overlay-dialog-title={title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/28 px-3 py-3 backdrop-blur-[2px] sm:px-6 sm:py-6"
      onClick={() => {
        console.debug("[OverlayDialog] backdrop click", {
          title,
          closeOnBackdropClick,
          closeOnEscape,
          open,
        });
        if (closeOnBackdropClick) {
          onClose();
        }
      }}
    >
      <div
        data-overlay-dialog-panel="true"
        data-overlay-dialog-title={title}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_80px_-40px_rgba(31,42,40,0.7)] backdrop-blur-xl sm:max-h-[calc(100dvh-3rem)]",
          panelClassName || "max-w-lg",
        )}
        onClick={(event) => {
          console.debug("[OverlayDialog] panel click", {
            title,
            target:
              event.target instanceof HTMLElement
                ? {
                    tagName: event.target.tagName,
                    className: event.target.className,
                    text: event.target.textContent?.trim().slice(0, 80) ?? "",
                  }
                : null,
          });
          event.stopPropagation();
        }}
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

          <Button aria-label="닫기" onClick={onClose} size="sm">
            닫기
          </Button>
        </div>

        <div className="mt-5 overflow-y-auto pr-1 sm:pr-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
