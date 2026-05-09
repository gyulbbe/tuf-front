"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AdSlotProps = {
  className?: string;
  slotId: string;
  title?: string;
};

type KakaoAdFitSlotConfig = {
  height: number;
  unit: string;
  width: number;
};

const KAKAO_ADFIT_SCRIPT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";
const PC_AD_MEDIA_QUERY = "(min-width: 1024px)";

const kakaoAdSlots: Record<
  string,
  {
    mobile: KakaoAdFitSlotConfig;
    pc: KakaoAdFitSlotConfig;
  }
> = {
  "bottom-banner": {
    mobile: {
      height: 100,
      unit: process.env.NEXT_PUBLIC_KAKAO_BOTTOM_MOBILE_UNIT ?? "",
      width: 320,
    },
    pc: {
      height: 90,
      unit: process.env.NEXT_PUBLIC_KAKAO_BOTTOM_PC_UNIT ?? "",
      width: 728,
    },
  },
  "top-banner": {
    mobile: {
      height: 100,
      unit: process.env.NEXT_PUBLIC_KAKAO_TOP_MOBILE_UNIT ?? "",
      width: 320,
    },
    pc: {
      height: 90,
      unit: process.env.NEXT_PUBLIC_KAKAO_TOP_PC_UNIT ?? "",
      width: 728,
    },
  },
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => {
      mediaQuery.removeEventListener("change", updateMatches);
    };
  }, [query]);

  return matches;
}

function KakaoAdFitSlot({ height, unit, width }: KakaoAdFitSlotConfig) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", unit);
    ins.setAttribute("data-ad-width", String(width));
    ins.setAttribute("data-ad-height", String(height));

    const script = document.createElement("script");
    script.async = true;
    script.src = KAKAO_ADFIT_SCRIPT_SRC;
    script.type = "text/javascript";

    mount.replaceChildren(ins, script);

    return () => {
      mount.replaceChildren();
    };
  }, [height, unit, width]);

  return (
    <div
      ref={mountRef}
      className="flex items-center justify-center overflow-hidden"
      style={{ minHeight: height }}
    />
  );
}

export function AdSlot({ className, slotId }: AdSlotProps) {
  const pathname = usePathname();
  const isPcAdViewport = useMediaQuery(PC_AD_MEDIA_QUERY);
  const adProvider = process.env.NEXT_PUBLIC_AD_PROVIDER;
  const kakaoSlotGroup = kakaoAdSlots[slotId];
  const kakaoSlot = isPcAdViewport
    ? kakaoSlotGroup?.pc
    : kakaoSlotGroup?.mobile;
  const shouldRenderKakaoAd =
    adProvider === "kakao" &&
    Boolean(kakaoSlot?.unit) &&
    Boolean(pathname);

  if (!shouldRenderKakaoAd) {
    return null;
  }

  return (
    <aside
      data-ad-slot={slotId}
      className={cn(
        "rounded-[24px] border border-dashed border-line bg-surface px-4 py-4 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl",
        className,
      )}
    >
      <KakaoAdFitSlot {...kakaoSlot} />
    </aside>
  );
}
