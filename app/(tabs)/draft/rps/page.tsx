import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";

export const metadata: Metadata = {
  title: "가위바위보 팀 정하기",
};

export default function DraftRpsPage() {
  return <RpsDraftListPage />;
}
