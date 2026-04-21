import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardDetailPage } from "@/components/board/board-detail-page";

export const metadata: Metadata = {
  title: "게시글 상세",
};

type NoticeDetailPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function NoticeDetailPage({
  params,
}: NoticeDetailPageProps) {
  const resolvedParams = await params;
  const boardId = Number(resolvedParams.boardId);

  if (!Number.isInteger(boardId) || boardId < 1) {
    notFound();
  }

  return <BoardDetailPage boardId={boardId} />;
}
