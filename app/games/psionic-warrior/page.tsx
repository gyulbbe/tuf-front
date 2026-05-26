"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const PsionicWarriorGame = dynamic(() => import("./_game/game-root"), {
  loading: (): ReactElement => <div className="min-h-screen bg-[#101827]" />,
  ssr: false,
});

export default function PsionicWarriorPage(): ReactElement {
  return <PsionicWarriorGame />;
}
