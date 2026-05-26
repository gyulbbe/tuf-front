"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const BerserkerBrothersGame = dynamic(() => import("./_game/game-root"), {
  loading: (): ReactElement => <div className="min-h-screen bg-[#05030d]" />,
  ssr: false,
});

export default function BerserkerBrothersPage(): ReactElement {
  return <BerserkerBrothersGame />;
}
