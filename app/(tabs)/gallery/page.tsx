import type { Metadata } from "next";
import { InfoList } from "@/components/site/info-list";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const gallerySections = [
  {
    title: "최근 업로드",
    description:
      "스크린샷, 단체 화면, 기타 이미지를 최근순으로 정리하는 기본 영역입니다.",
  },
  {
    title: "카테고리",
    description:
      "시즌별, 이벤트별, 멤버별로 나누기 좋게 구조를 미리 준비해 둡니다.",
  },
  {
    title: "보관 규칙",
    description:
      "이미지 설명, 업로드 날짜, 작성자를 같이 적어두면 관리가 쉬워집니다.",
  },
];

const uploadChecklist = ["썸네일 정책", "카테고리 체계", "업로드 권한 분리"];

export const metadata: Metadata = {
  title: "터프 갤러리",
};

export default function GalleryPage() {
  return (
    <TabPageShell
      label="Gallery"
      title="터프 갤러리"
      description="갤러리는 이후 이미지가 많이 쌓여도 라우트와 카드 구조만 유지하면 계속 확장할 수 있도록, 처음부터 보관 탭으로 분리해 두었습니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">업로드 준비 항목</p>
            <InfoList items={uploadChecklist} />
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">구성 메모</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              처음에는 카드 몇 개만 보여주고, 이후에는 masonry나 상세 보기 같은
              시각 요소를 별도 컴포넌트로 확장하면 됩니다.
            </p>
          </SurfaceCard>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {gallerySections.map((section) => (
          <SectionCard
            key={section.title}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    </TabPageShell>
  );
}
