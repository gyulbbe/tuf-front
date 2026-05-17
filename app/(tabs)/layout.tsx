import Image from "next/image";
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
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
      <header className="relative z-[80] isolate rounded-lg border border-white/20 bg-foreground p-3 shadow-[0_18px_56px_rgba(23,33,43,0.16)] sm:p-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-lg bg-foreground"
        >
          <Image
            src={siteConfig.brand.headerBackgroundSrc}
            alt=""
            fill
            preload
            sizes="(max-width: 768px) 100vw, 1600px"
            className="scale-105 object-cover object-center opacity-55 blur-[1.5px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,18,25,0.84)_0%,rgba(23,33,43,0.48)_48%,rgba(237,243,248,0.46)_100%)]" />
          <div className="absolute inset-x-3 top-1 h-32 sm:inset-x-8 sm:top-2 sm:h-36 lg:h-40">
            <Image
              src={siteConfig.brand.headerBackgroundSrc}
              alt=""
              fill
              sizes="(max-width: 768px) 92vw, 760px"
              className="object-contain object-center opacity-80"
            />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.16),transparent_34%),linear-gradient(180deg,rgba(13,18,25,0.06)_0%,rgba(13,18,25,0.18)_100%)]" />
        </div>

        <div className="relative z-10 grid min-h-[158px] content-between gap-5 sm:min-h-[170px] lg:min-h-[184px]">
          <div className="flex min-w-0 justify-end">
            <div className="flex min-w-0 justify-end">
              <HeaderAuthButton />
            </div>
          </div>

          <SiteTabs tabs={siteTabs} />
        </div>
      </header>

      <div className="relative z-0 py-4">
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
