import type { Metadata } from "next";
import { InfoList } from "@/components/site/info-list";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const notices = [
  {
    title: "사이트 구조 정리 완료",
    description: "메인 홈은 탭 구조로 전환했고, 각 탭은 개별 라우트로 분리했습니다.",
  },
  {
    title: "회원 기능 1차 적용",
    description: "내정보 탭에서 로그인, 로그아웃, 계정 상태 확인을 바로 처리할 수 있습니다.",
  },
  {
    title: "다음 작업 후보",
    description: "공지 작성 기능, 봇 명령 관리, 리그 데이터 연결을 다음 단계로 붙일 수 있습니다.",
  },
];

const quickLinks = [
  "운영 공지 등록",
  "업데이트 로그 분리",
  "상단 고정 공지 추가",
];

export const metadata: Metadata = {
  title: "공지사항",
};

export default function NoticePage() {
  return (
    <TabPageShell
      label="Notice"
      title="공지사항"
      description="지금 중요한 안내와 최근 업데이트를 먼저 보여주는 탭입니다. 이후에는 작성 기능과 고정 공지, 카테고리 분리만 얹어도 자연스럽게 커질 수 있습니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">바로 이어질 기능</p>
            <InfoList items={quickLinks} />
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">운영 메모</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              공지사항은 탭 중 가장 먼저 완성되는 영역으로 보고, 나중에 관리자
              글쓰기나 중요도 태그만 추가해도 충분히 확장 가능합니다.
            </p>
          </SurfaceCard>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {notices.map((notice) => (
          <SectionCard
            key={notice.title}
            title={notice.title}
            description={notice.description}
          />
        ))}
      </div>
    </TabPageShell>
  );
}
