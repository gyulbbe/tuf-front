import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "팀배/컨텐츠 드래프트",
};

export default function DraftRpsPage() {
  redirect("/draft");
}
