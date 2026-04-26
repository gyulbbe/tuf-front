import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "게임",
};

export default function GamesPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-foreground">게임</h1>
        <Link
          href="/games/escape-fps"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-md border border-line bg-surface-strong px-5 text-base font-bold text-foreground transition-colors hover:border-accent hover:text-accent-ink"
        >
          방탈출
        </Link>
      </div>
    </main>
  );
}
