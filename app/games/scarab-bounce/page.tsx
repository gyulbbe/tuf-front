"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const ScarabBounceGame = dynamic(() => import("./_game/game-root"), {
  loading: (): ReactElement => <div className="min-h-screen bg-[#111827]" />,
  ssr: false,
});

export default function ScarabBouncePage(): ReactElement {
  return <ScarabBounceGame />;
}
