import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { proleagueDraftListPath } from "@/lib/proleague-draft/routes";

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

  redirect(proleagueDraftListPath());
}
