import Link from "next/link";
import { AdSlot } from "@/components/site/ad-slot";
import { HeaderAuthButton } from "@/components/auth/header-auth-button";
import { SiteTabs } from "@/components/site/site-tabs";
import { siteConfig, siteTabs } from "@/content/site";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <header className="relative z-40 isolate rounded-[28px] border border-line bg-surface px-5 py-5 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="absolute right-5 top-5 sm:right-6">
            <HeaderAuthButton />
          </div>

          <Link
            href="/gallery"
            className="mx-auto inline-flex rounded-[22px] border border-transparent px-2 py-1 pr-24 text-center text-lg font-semibold text-foreground transition-colors hover:border-line sm:pr-0"
          >
            {siteConfig.name}
          </Link>

          <SiteTabs tabs={siteTabs} />
        </div>
      </header>

      <div className="py-4">
        <AdSlot slotId="top-banner" />
      </div>

      <main className="flex-1 pb-4">{children}</main>

      <div className="pb-4">
        <AdSlot slotId="bottom-banner" />
      </div>

      <footer className="rounded-[24px] border border-line bg-surface px-5 py-4 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl sm:px-6">
        <p className="text-center text-sm font-medium text-foreground">
          {siteConfig.name}
        </p>
      </footer>
    </div>
  );
}
