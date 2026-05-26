import Link from "next/link";
import { gameCatalogItems } from "@/content/games";
import { SurfaceCard } from "@/components/site/surface-card";

export function GameLibrary() {
  return (
    <SurfaceCard className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Games
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            게임
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
            TuF에서 바로 실행할 수 있는 게임과 실험 기능을 모아둔 공간입니다.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {gameCatalogItems.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="group rounded-lg border border-line bg-white px-6 py-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)] transition-colors hover:border-accent hover:bg-accent-soft/40"
          >
            <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink">
              {game.badge}
            </span>
            <h2 className="mt-4 text-xl font-bold text-foreground group-hover:text-accent-ink">
              {game.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              {game.description}
            </p>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  );
}
