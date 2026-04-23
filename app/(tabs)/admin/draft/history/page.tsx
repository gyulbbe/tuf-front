import type { Metadata } from "next";
import { DraftHistoryConsole } from "@/components/proleague/draft-history-console";

export const metadata: Metadata = {
  title: "관리자 드래프트 종료 이력",
};

export default function AdminDraftHistoryPage() {
  return <DraftHistoryConsole />;
}
