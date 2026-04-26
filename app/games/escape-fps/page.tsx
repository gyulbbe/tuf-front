"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const GameRoot = dynamic(() => import("./_game/game-root"), {
  loading: (): ReactElement => <div className="h-screen w-screen bg-black" />,
  ssr: false,
});

export default function EscapeFpsPage(): ReactElement {
  return <GameRoot />;
}
