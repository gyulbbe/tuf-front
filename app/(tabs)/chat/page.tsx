import type { Metadata } from "next";
import { TufBotChat } from "@/components/chat/tuf-bot-chat";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "터프봇",
};

export default function ChatPage() {
  return (
    <SurfaceCard className="h-[clamp(540px,calc(100svh-22rem),760px)] overflow-hidden p-0">
      <TufBotChat />
    </SurfaceCard>
  );
}
