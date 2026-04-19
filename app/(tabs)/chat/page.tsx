import type { Metadata } from "next";
import { TufBotChat } from "@/components/chat/tuf-bot-chat";
import { SurfaceCard } from "@/components/site/surface-card";

export const metadata: Metadata = {
  title: "채팅",
};

export default function ChatPage() {
  return (
    <SurfaceCard className="min-h-[720px] overflow-hidden p-0">
      <TufBotChat />
    </SurfaceCard>
  );
}
