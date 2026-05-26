import type { Metadata } from "next";
import { GameLibrary } from "@/components/games/game-library";

export const metadata: Metadata = {
  title: "게임",
};

export default function GamesPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <GameLibrary />
      </div>
    </main>
  );
}
