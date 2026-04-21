import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";

export const metadata: Metadata = {
  title: "가위바위보 드래프트",
};

export default function RpsDraftIndexPage() {
  return <RpsDraftListPage />;
}
