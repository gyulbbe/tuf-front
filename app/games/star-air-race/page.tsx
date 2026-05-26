"use client";

import type { ReactElement } from "react";
import dynamic from "next/dynamic";

const StarAirRaceGame = dynamic(() => import("./_game/game-root"), {
  loading: (): ReactElement => <div className="min-h-screen bg-[#07111f]" />,
  ssr: false,
});

export default function StarAirRacePage(): ReactElement {
  return <StarAirRaceGame />;
}
