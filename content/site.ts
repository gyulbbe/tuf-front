export type SiteMenuVisibilityKey =
  | "chat"
  | "draft.proleague"
  | "draft.content"
  | "game"
  | "gallery"
  | "admin.proleague"
  | "admin.proleagueHistory"
  | "admin.draftHistory"
  | "admin.users"
  | "admin.homeSchedules"
  | "admin.maps"
  | "external.recordManager"
  | "external.betting";

export type SiteReservedMenuKey = "admin" | "admin.menuVisibility";

export type SiteMenuKey = SiteMenuVisibilityKey | SiteReservedMenuKey;

export type SiteSubTab = {
  label: string;
  href?: string;
  description: string;
  external?: boolean;
  requiresAdmin?: boolean;
  menuKey?: SiteMenuKey;
};

export type SiteTab = SiteSubTab & {
  items?: SiteSubTab[];
};

export type SiteMenuVisibilityMeta = {
  menuKey: SiteMenuVisibilityKey;
  label: string;
  description: string;
};

const externalSiteLinks = {
  recordManagerUrl: "https://tufelo.vercel.app/",
  bettingUrl: "https://tufpl.vercel.app/",
};

export const siteConfig = {
  name: "Starcraft TuF Clan",
  description:
    "터프봇, 드래프트, 게임, 갤러리, 관리자 기능을 한 화면에서 관리하는 Starcraft TuF Clan 사이트입니다.",
  brand: {
    headerBackgroundSrc: "/brand/tuf-logo.png",
    shortName: "TuF",
    tagline: "Clan command center",
  },
};

export const siteMenuVisibilityItems: SiteMenuVisibilityMeta[] = [
  {
    menuKey: "chat",
    label: "터프봇",
    description: "상단 터프봇 탭 표시 여부를 관리합니다.",
  },
  {
    menuKey: "draft.proleague",
    label: "프로리그 드래프트",
    description: "드래프트 메뉴의 프로리그 드래프트 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "draft.content",
    label: "컨텐츠 드래프트",
    description: "드래프트 메뉴의 컨텐츠 드래프트 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "game",
    label: "게임",
    description: "상단 게임 탭 표시 여부를 관리합니다.",
  },
  {
    menuKey: "gallery",
    label: "TuF 갤러리",
    description: "상단 TuF 갤러리 탭 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.proleague",
    label: "프로리그 등록",
    description: "관리자 메뉴의 프로리그 등록 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.proleagueHistory",
    label: "프로리그 이력",
    description: "관리자 메뉴의 프로리그 이력 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.draftHistory",
    label: "드래프트 이력",
    description: "관리자 메뉴의 드래프트 이력 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.users",
    label: "사용자 관리",
    description: "관리자 메뉴의 사용자 관리 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.homeSchedules",
    label: "일정 관리",
    description: "관리자 메뉴의 일정 관리 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "admin.maps",
    label: "맵 관리",
    description: "관리자 메뉴의 맵 관리 항목 표시 여부를 관리합니다.",
  },
  {
    menuKey: "external.recordManager",
    label: "전적관리",
    description: "상단 전적관리 외부 링크 표시 여부를 관리합니다.",
  },
  {
    menuKey: "external.betting",
    label: "배팅",
    description: "상단 배팅 외부 링크 표시 여부를 관리합니다.",
  },
];

export const siteTabs: SiteTab[] = [
  {
    label: "터프봇",
    href: "/chat",
    description: "터프봇 자동 응답 흐름을 확인합니다.",
    menuKey: "chat",
  },
  {
    label: "드래프트",
    href: "/draft",
    description: "드래프트 화면과 운영 화면으로 이동합니다.",
    items: [
      {
        label: "프로리그 드래프트",
        href: "/proleague/draft",
        description: "프로리그 드래프트 화면으로 이동합니다.",
        menuKey: "draft.proleague",
      },
      {
        label: "컨텐츠 드래프트",
        href: "/draft",
        description: "팀배/컨텐츠 드래프트 화면으로 이동합니다.",
        menuKey: "draft.content",
      },
    ],
  },
  {
    label: "토너먼트",
    href: "/tournament",
    description: "듀얼 토너먼트 조별 대진표를 확인합니다.",
  },
  {
    label: "TuF 갤러리",
    href: "/gallery",
    description: "게시물과 기록을 확인합니다.",
    menuKey: "gallery",
  },
  {
    label: "게임",
    href: "/game",
    description: "게임 안내와 준비 중인 기능을 확인합니다.",
    menuKey: "game",
  },
  {
    label: "관리자",
    href: "/admin",
    description: "관리자 작업 공간입니다.",
    requiresAdmin: true,
    menuKey: "admin",
    items: [
      {
        label: "프로리그 등록",
        href: "/admin/proleague",
        description: "프로리그 기본 정보와 드래프트 생성을 등록합니다.",
        requiresAdmin: true,
        menuKey: "admin.proleague",
      },
      {
        label: "프로리그 이력",
        href: "/admin/proleague/history",
        description: "종료된 프로리그 결과와 팀 구성을 확인하고 삭제합니다.",
        requiresAdmin: true,
        menuKey: "admin.proleagueHistory",
      },
      {
        label: "드래프트 이력",
        href: "/admin/draft/history",
        description: "종료된 드래프트 기록을 확인합니다.",
        requiresAdmin: true,
        menuKey: "admin.draftHistory",
      },
      {
        label: "사용자 관리",
        href: "/admin/users",
        description: "사용자 조회, 등록, 수정, 상태 변경을 관리합니다.",
        requiresAdmin: true,
        menuKey: "admin.users",
      },
      {
        label: "일정 관리",
        href: "/admin/home/schedules",
        description: "메인화면에 표시할 일정을 등록하고 수정합니다.",
        requiresAdmin: true,
        menuKey: "admin.homeSchedules",
      },
      {
        label: "맵 관리",
        href: "/admin/maps",
        description: "일정 세트 대진에서 사용할 맵을 등록하고 수정합니다.",
        requiresAdmin: true,
        menuKey: "admin.maps",
      },
      {
        label: "메뉴 설정",
        href: "/admin/menu-visibility",
        description: "사이트 메뉴 노출 여부를 관리합니다.",
        requiresAdmin: true,
        menuKey: "admin.menuVisibility",
      },
    ],
  },
  {
    label: "전적관리",
    href: externalSiteLinks.recordManagerUrl,
    description: "전적관리 사이트로 이동합니다.",
    external: true,
    menuKey: "external.recordManager",
  },
  {
    label: "배팅",
    href: externalSiteLinks.bettingUrl,
    description: "배팅 사이트로 이동합니다.",
    external: true,
    menuKey: "external.betting",
  },
];
