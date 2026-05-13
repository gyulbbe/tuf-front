"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const DISMISSED_AT_KEY = "tuf.adBlockNotice.dismissedAt";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;
const AD_PROVIDER = process.env.NEXT_PUBLIC_AD_PROVIDER;

function hasRecentDismissal() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));

    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    // Storage can be blocked in private browsing. The notice still works without persistence.
  }
}

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

  if (adSlots.length === 0) {
    return false;
  }

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
  const blockedAdSlot = adSlots.some((slot) => isHiddenByBlocker(slot));

  bait.remove();

  return blockedByBait || blockedAdSlot;
}

export function AdBlockNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (AD_PROVIDER !== "kakao" || hasRecentDismissal()) {
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

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-xl rounded-lg border border-line-strong bg-surface px-5 py-4 shadow-[0_20px_70px_rgba(23,33,43,0.22)] sm:bottom-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">
            광고 차단 기능이 켜져 있습니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            사이트 운영을 위해 광고 차단을 해제한 뒤 새로고침해 주세요.
            해제가 어렵다면 이 안내는 하루 동안 숨길 수 있습니다.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            rememberDismissal();
            setIsVisible(false);
          }}
        >
          나중에
        </Button>
      </div>
    </aside>
  );
}
