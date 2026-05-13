import Link from "next/link";
import { AdBlockNotice } from "@/components/site/ad-block-notice";
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
      <header className="relative z-40 isolate rounded-lg border border-line bg-surface px-5 py-5 shadow-[0_16px_50px_rgba(23,33,43,0.08)] sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="absolute right-5 top-5 sm:right-6">
            <HeaderAuthButton />
          </div>

          <Link
            href="/"
            className="mx-auto inline-flex rounded-lg border border-transparent px-2 py-1 pr-24 text-center text-lg font-semibold text-foreground transition-colors hover:border-line sm:pr-0"
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

      <footer className="rounded-lg border border-line bg-surface px-5 py-4 shadow-[0_16px_50px_rgba(23,33,43,0.08)] sm:px-6">
        <p className="text-center text-sm font-medium text-foreground">
          {siteConfig.name}
        </p>
      </footer>

      <AdBlockNotice />
    </div>
  );
}
