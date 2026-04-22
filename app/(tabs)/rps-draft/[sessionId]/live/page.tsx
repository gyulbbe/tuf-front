import { redirect } from "next/navigation";

type LegacyRpsDraftLivePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function LegacyRpsDraftLivePage({
  params,
}: LegacyRpsDraftLivePageProps) {
  const resolvedParams = await params;
  redirect(`/draft/rps/${resolvedParams.sessionId}/live`);
}
