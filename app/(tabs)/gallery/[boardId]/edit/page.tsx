import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardFormPage } from "@/components/board/board-form-page";

export const metadata: Metadata = {
  title: "게시글 수정",
};

type GalleryEditPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function GalleryEditPage({
  params,
}: GalleryEditPageProps) {
  const resolvedParams = await params;
  const boardId = Number(resolvedParams.boardId);

  if (!Number.isInteger(boardId) || boardId < 1) {
    notFound();
  }

  return <BoardFormPage mode="edit" boardId={boardId} />;
}
