export type SiteSubTab = {
  label: string;
  href?: string;
  description: string;
  external?: boolean;
  requiresAdmin?: boolean;
};

export type SiteTab = SiteSubTab & {
  items?: SiteSubTab[];
};

const externalSiteLinks = {
  recordManagerUrl: "https://tufelo.vercel.app/",
  bettingUrl: "https://tufpl.vercel.app/",
};

export const siteConfig = {
  name: "Starcraft TuF Clan",
  description:
    "공지, 터프봇, 프로리그, 게임, 갤러리, 관리자 기능을 한 화면에서 관리하는 Starcraft TuF Clan 사이트입니다.",
};

export const siteTabs: SiteTab[] = [
  {
    label: "공지사항",
    href: "/notice",
    description: "운영 공지와 업데이트를 확인합니다.",
  },
  {
    label: "터프봇",
    href: "/chat",
    description: "채팅 기능과 자동 응답 흐름을 확인합니다.",
  },
  {
    label: "프로리그",
    href: "/proleague",
    description: "리그 운영 상태와 주요 기능으로 이동합니다.",
    items: [
      {
        label: "프로리그 드래프트",
        href: "/proleague/draft",
        description: "기존 프로리그 드래프트 화면으로 이동합니다.",
      },
    ],
  },
  {
    label: "드래프트",
    href: "/draft",
    description: "팀배/컨텐츠 드래프트 화면으로 이동합니다.",
  },
  {
    label: "게임",
    href: "/game",
    description: "게임 관련 안내와 준비 중인 기능을 확인합니다.",
  },
  {
    label: "터프 갤러리",
    href: "/gallery",
    description: "이미지와 기록을 모아 보는 공간입니다.",
  },
  {
    label: "관리자",
    href: "/admin",
    description: "관리자 작업 공간입니다.",
    requiresAdmin: true,
    items: [
      {
        label: "팀배/컨텐츠 드래프트 관리",
        href: "/admin/draft",
        description: "팀배/컨텐츠 드래프트 관리와 이력을 확인합니다.",
        requiresAdmin: true,
      },
    ],
  },
  {
    label: "전적관리",
    href: externalSiteLinks.recordManagerUrl,
    description: "외부 전적관리 사이트로 이동합니다.",
    external: true,
  },
  {
    label: "배팅",
    href: externalSiteLinks.bettingUrl,
    description: "외부 배팅 사이트로 이동합니다.",
    external: true,
  },
];
