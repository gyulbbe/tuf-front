import { redirect } from "next/navigation";

type LegacyRpsDraftSessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function LegacyRpsDraftSessionPage({
  params,
}: LegacyRpsDraftSessionPageProps) {
  const resolvedParams = await params;
  redirect(`/draft/rps/${resolvedParams.sessionId}`);
}
