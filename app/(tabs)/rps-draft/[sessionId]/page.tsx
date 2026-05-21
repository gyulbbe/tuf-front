import { redirect } from "next/navigation";

type LegacyRpsDraftRedirectPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function LegacyRpsDraftRedirectPage({
  params,
}: LegacyRpsDraftRedirectPageProps) {
  const resolvedParams = await params;

  redirect(`/draft/rps/${resolvedParams.sessionId}/live`);
}
