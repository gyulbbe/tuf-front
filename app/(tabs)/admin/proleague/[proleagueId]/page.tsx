import { redirect } from "next/navigation";

type AdminProleagueEditPageProps = {
  params: Promise<{
    proleagueId: string;
  }>;
};

export default async function AdminProleagueEditPage({
  params,
}: AdminProleagueEditPageProps) {
  const { proleagueId } = await params;
  redirect(`/admin/league/${proleagueId}`);
}
