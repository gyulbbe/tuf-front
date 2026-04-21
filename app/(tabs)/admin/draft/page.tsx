import type { Metadata } from "next";
import { AdminProleagueWorkspace } from "@/components/proleague/admin-proleague-workspace";

export const metadata: Metadata = {
  title: "관리자 팀배/컨텐츠 드래프트 관리",
};

export default function AdminDraftPage() {
  return <AdminProleagueWorkspace />;
}
