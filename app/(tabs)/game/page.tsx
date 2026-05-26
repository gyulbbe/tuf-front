import type { Metadata } from "next";
import { GameLibrary } from "@/components/games/game-library";

export const metadata: Metadata = {
  title: "게임",
};

export default function GamePage() {
  return <GameLibrary />;
}
