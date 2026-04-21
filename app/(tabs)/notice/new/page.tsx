import type { Metadata } from "next";
import { BoardFormPage } from "@/components/board/board-form-page";

export const metadata: Metadata = {
  title: "글쓰기",
};

export default function NoticeWritePage() {
  return <BoardFormPage mode="create" />;
}
