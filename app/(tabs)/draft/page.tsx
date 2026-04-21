import type { Metadata } from "next";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "팀배/컨텐츠 드래프트",
};

export default async function DraftPage() {
  await requireServerAuth("/draft");

  return <DraftLiveDashboard variant="content" />;
}
