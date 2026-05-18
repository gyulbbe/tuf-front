import { redirect } from "next/navigation";

type AdminPersonalLeagueEditPageProps = {
  params: Promise<{
    personalLeagueId: string;
  }>;
};

export default async function AdminPersonalLeagueEditPage({
  params,
}: AdminPersonalLeagueEditPageProps) {
  const { personalLeagueId } = await params;
  redirect(`/admin/league/${personalLeagueId}`);
}
