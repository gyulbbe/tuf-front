"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const AD_PROVIDER = process.env.NEXT_PUBLIC_AD_PROVIDER;

function isHiddenByBlocker(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    !document.body.contains(element) ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity || "1") === 0 ||
    rect.width === 0 ||
    rect.height === 0
  );
}

async function detectAdBlock() {
  const adSlots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-ad-slot]"),
  );

  const bait = document.createElement("div");
  bait.className =
    "adsbox ad-banner adsbygoogle advertisement kakao_ad_area pub_300x250";
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;pointer-events:none;";

  document.body.appendChild(bait);

  await new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });

  const blockedByBait = isHiddenByBlocker(bait);
  const blockedAdSlot =
    adSlots.length > 0 && adSlots.some((slot) => isHiddenByBlocker(slot));

  bait.remove();

  return blockedByBait || blockedAdSlot;
}

export function AdBlockNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (AD_PROVIDER !== "kakao") {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void detectAdBlock().then((blocked) => {
        if (!cancelled && blocked) {
          setIsVisible(true);
        }
      });
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 px-3 pt-4 backdrop-blur-[2px] sm:px-6 sm:pt-6">
      <aside
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ad-block-notice-title"
        aria-describedby="ad-block-notice-description"
        className="mx-auto max-w-2xl rounded-lg border border-line-strong bg-surface px-5 py-4 shadow-[0_20px_70px_rgba(23,33,43,0.22)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              id="ad-block-notice-title"
              className="text-base font-semibold text-foreground"
            >
              광고 차단 기능이 켜져 있습니다.
            </p>
            <p
              id="ad-block-notice-description"
              className="mt-2 text-sm leading-6 text-muted"
            >
              사이트 이용을 계속하려면 광고 차단을 해제한 뒤 새로고침해 주세요.
            </p>
          </div>

          <Button
            size="sm"
            variant="accent"
            onClick={() => {
              window.location.reload();
            }}
          >
            새로고침
          </Button>
        </div>
      </aside>
    </div>
  );
}
