import type { Metadata } from "next";
import { TufBotChat } from "@/components/chat/tuf-bot-chat";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const quickGuide = [
  "클랜 소식, 일정, 소개 문구처럼 짧고 즉답형 질문부터 던지기",
  "답변이 길면 말풍선에서 타이핑되듯 순서대로 표시됨",
  "로그인 중이면 계정명으로, 아니면 guest로 요청이 전송됨",
];

const featureNotes = [
  "실제 API는 `POST /chat` 한 번으로 문자열 답변을 돌려주고, 화면에서는 실시간처럼 흘려보내도록 구성했다.",
  "현재 프로젝트 기본 API 주소는 `.env.local` 기준 `http://localhost:8080`이라서 로컬 백엔드와 바로 붙일 수 있다.",
];

export const metadata: Metadata = {
  title: "채팅",
};

export default function ChatPage() {
  return (
    <TabPageShell
      label="Chat"
      title="터프봇 실시간 채팅"
      description="터프봇에게 바로 질문을 던지고 응답을 대화형으로 확인하는 화면이다. 빠른 질문 버튼, 실시간 타이핑 표현, guest/로그인 사용자 전송 흐름을 한 번에 묶었다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">바로 써보기</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-muted">
              {quickGuide.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">연결 메모</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
              {featureNotes.map((note) => (
                <p
                  key={note}
                  className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground"
                >
                  {note}
                </p>
              ))}
            </div>
          </SurfaceCard>
        </>
      }
    >
      <TufBotChat />
    </TabPageShell>
  );
}
