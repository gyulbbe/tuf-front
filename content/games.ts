export type GameCatalogItem = {
  badge: string;
  description: string;
  href: string;
  title: string;
};

export const gameCatalogItems: GameCatalogItem[] = [
  {
    badge: "Survival",
    description:
      "황금빛 사이오닉 전사가 몰려오는 군단을 상대로 버티며 진화하는 실시간 생존 액션입니다.",
    href: "/game/psionic-survival",
    title: "사이오닉 서바이벌",
  },
  {
    badge: "Action",
    description:
      "사이오닉 전사가 방 단위 던전을 돌파하며 투사체를 피하고 유물로 성장하는 실시간 액션 로그라이트입니다.",
    href: "/game/psionic-warrior",
    title: "사이오닉 전사 키우기",
  },
  {
    badge: "FPS",
    description: "어두운 시설을 1인칭으로 탐색하는 방탈출 슈팅 프로토타입입니다.",
    href: "/games/escape-fps",
    title: "방탈출",
  },
  {
    badge: "Arcade",
    description:
      "스캐럽을 좌우로 움직여 특수 발판, 벽타기, 가시 구간을 돌파하는 100스테이지 아케이드입니다.",
    href: "/games/scarab-bounce",
    title: "스캐럽 튀기기",
  },
  {
    badge: "Arcade",
    description:
      "10개 스테이지마다 세 보스를 돌파하고 수정 열쇠를 차원문까지 운반하는 고정 화면 사이오닉 아케이드입니다.",
    href: "/games/berserker-brothers",
    title: "광전사 브라더스",
  },
  {
    badge: "Racing",
    description:
      "테란, 저그, 프로토스풍 공중 기체들이 거대한 SF 코스를 3바퀴 선착순으로 질주하는 Canvas 레이싱입니다.",
    href: "/games/star-air-race",
    title: "스타 에어 레이스",
  },
];
