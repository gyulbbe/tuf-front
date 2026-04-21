import { notFound, redirect } from "next/navigation";

type NoticeEditPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function NoticeEditPage({ params }: NoticeEditPageProps) {
  const resolvedParams = await params;
  const boardId = Number(resolvedParams.boardId);

  if (!Number.isInteger(boardId) || boardId < 1) {
    notFound();
  }

  redirect(`/gallery/${boardId}/edit`);
}
