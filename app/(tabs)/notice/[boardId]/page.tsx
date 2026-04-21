import { notFound, redirect } from "next/navigation";

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

  redirect(`/gallery/${boardId}`);
}
