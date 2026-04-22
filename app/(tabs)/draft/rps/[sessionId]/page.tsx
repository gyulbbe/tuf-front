import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RpsDraftSessionPage } from "@/components/rps-draft/rps-draft-session-page";

export const metadata: Metadata = {
  title: "팀배/컨텐츠 드래프트 설정",
};

type DraftRpsSessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function DraftRpsSessionPage({
  params,
}: DraftRpsSessionPageProps) {
  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.sessionId);

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    notFound();
  }

  return <RpsDraftSessionPage sessionId={sessionId} />;
}
