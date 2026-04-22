import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProleagueDraftSessionPage } from "@/components/proleague/proleague-draft-session-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "프로리그 드래프트 설정",
};

type ProleagueDraftSessionRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ProleagueDraftSessionRoute({
  params,
}: ProleagueDraftSessionRouteProps) {
  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.sessionId);

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    notFound();
  }

  await requireServerAuth(`/proleague/draft/${sessionId}`);

  return <ProleagueDraftSessionPage sessionId={sessionId} />;
}
