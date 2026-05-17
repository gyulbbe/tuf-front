import type { Metadata } from "next";
import { TufBotChat } from "@/components/chat/tuf-bot-chat";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "터프봇",
};

export default function ChatPage() {
  return (
    <SurfaceCard className="h-[clamp(620px,calc(100svh-20rem),880px)] overflow-hidden p-0">
      <TufBotChat />
    </SurfaceCard>
  );
}
