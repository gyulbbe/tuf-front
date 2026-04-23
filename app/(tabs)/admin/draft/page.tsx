import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "관리자 드래프트 종료 이력으로 이동",
};

export default function AdminDraftPage() {
  redirect("/admin/draft/history");
}
