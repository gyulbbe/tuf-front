"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const PsionicSurvivalGame = dynamic(
  () => import("@/app/games/psionic-survival/_game/game-root"),
  {
    loading: (): ReactElement => <div className="min-h-screen bg-[#101827]" />,
    ssr: false,
  },
);

export default function PsionicSurvivalTabPage(): ReactElement {
  return <PsionicSurvivalGame />;
}
