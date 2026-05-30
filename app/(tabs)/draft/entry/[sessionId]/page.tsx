import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntrySubmissionPage } from "@/components/entry-submission/entry-submission-page";

export const metadata: Metadata = {
  title: "엔트리 제출",
};

type DraftEntryPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function DraftEntryPage({ params }: DraftEntryPageProps) {
  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.sessionId);

  if (!Number.isInteger(sessionId) || sessionId < 1) {
    notFound();
  }

  return <EntrySubmissionPage sessionId={sessionId} />;
}
