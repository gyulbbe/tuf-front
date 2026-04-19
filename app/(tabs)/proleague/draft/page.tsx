import type { Metadata } from "next";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "프로리그 드래프트",
};

export default async function ProleagueDraftPage() {
  await requireServerAuth("/proleague/draft");

  return <DraftLiveDashboard />;
}
