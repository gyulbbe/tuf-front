import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RpsDraftLivePage } from "@/components/rps-draft/rps-draft-live-page";

export const metadata: Metadata = {
  title: "팀배/컨텐츠 드래프트 진행",
};

type DraftRpsLivePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function DraftRpsLivePage({
  params,
}: DraftRpsLivePageProps) {
  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.sessionId);

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    notFound();
  }

  return <RpsDraftLivePage sessionId={sessionId} />;
}
