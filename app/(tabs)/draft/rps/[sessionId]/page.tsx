import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "가위바위보 드래프트",
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

  redirect(`/draft/rps/${sessionId}/live`);
}
