import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProleagueDraftLivePage } from "@/components/proleague/proleague-draft-live-page";

export const metadata: Metadata = {
  title: "프로리그 드래프트 라이브",
};

type ProleagueDraftLiveRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ProleagueDraftLiveRoute({
  params,
}: ProleagueDraftLiveRouteProps) {
  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.sessionId);

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    notFound();
  }

  return <ProleagueDraftLivePage sessionId={sessionId} />;
}
