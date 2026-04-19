"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { requestTufBotChat } from "@/lib/api/chat";

type ChatMessageState = "complete" | "thinking" | "streaming" | "error";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  sender: string;
  text: string;
  createdAt: number;
  state: ChatMessageState;
};

const starterPrompts = [
  "오늘 터프 분위기 한 줄로 요약해줘.",
  "신규 유저에게 클랜 소개를 해줘.",
  "프로리그 소식 물어볼 때 쓸 질문 예시를 알려줘.",
];

function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    sender: "TUF BOT",
    text: "안녕. 터프봇이야. 클랜 얘기든 가벼운 잡담이든 편하게 던져줘.",
    createdAt: Date.now(),
    state: "complete",
  };
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="답변 생성 중">
      {Array.from({ length: 3 }).map((_, index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 rounded-full bg-current/55 animate-pulse"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </div>
  );
}

export function TufBotChat() {
  const { status, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(),
  ]);
  const [composer, setComposer] = useState("");
  const [phase, setPhase] = useState<"idle" | "waiting" | "streaming">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);

  const activeUserId = user?.username?.trim() || "guest";
  const isBusy = phase !== "idle";

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;

    if (!transcript) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function stopTypingTimer() {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  function resetConversation() {
    requestVersionRef.current += 1;
    stopTypingTimer();
    setPhase("idle");
    setComposer("");
    setErrorMessage(null);
    setMessages([createWelcomeMessage()]);
  }

  function streamReply(messageId: string, text: string) {
    stopTypingTimer();

    return new Promise<void>((resolve) => {
      const segments = Array.from(text);

      if (segments.length === 0) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, text, state: "complete" }
              : message,
          ),
        );
        resolve();
        return;
      }

      const step = segments.length > 240 ? 7 : segments.length > 120 ? 4 : 2;
      let cursor = 0;

      typingTimerRef.current = window.setInterval(() => {
        cursor = Math.min(cursor + step, segments.length);

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  text: segments.slice(0, cursor).join(""),
                  state: cursor >= segments.length ? "complete" : "streaming",
                }
              : message,
          ),
        );

        if (cursor >= segments.length) {
          stopTypingTimer();
          resolve();
        }
      }, 18);
    });
  }

  async function submitMessage(rawText?: string) {
    const text = (rawText ?? composer).trim();

    if (!text || isBusy) {
      return;
    }

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const nextRequestVersion = requestVersionRef.current + 1;

    requestVersionRef.current = nextRequestVersion;
    stopTypingTimer();
    setComposer("");
    setErrorMessage(null);
    setPhase("waiting");
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        sender: activeUserId === "guest" ? "Guest" : activeUserId,
        text,
        createdAt: Date.now(),
        state: "complete",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        sender: "TUF BOT",
        text: "",
        createdAt: Date.now(),
        state: "thinking",
      },
    ]);

    try {
      const response = await requestTufBotChat({
        userId: activeUserId,
        text,
      });

      if (requestVersionRef.current !== nextRequestVersion) {
        return;
      }

      setPhase("streaming");
      await streamReply(assistantMessageId, response.data);

      if (requestVersionRef.current === nextRequestVersion) {
        setPhase("idle");
      }
    } catch (error) {
      if (requestVersionRef.current !== nextRequestVersion) {
        return;
      }

      const nextErrorMessage = readErrorMessage(error);

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: nextErrorMessage,
                state: "error",
              }
            : message,
        ),
      );
      setErrorMessage(nextErrorMessage);
      setPhase("idle");
    }
  }

  const phaseLabel =
    phase === "waiting"
      ? "답변을 준비 중"
      : phase === "streaming"
        ? "답변을 표시하는 중"
        : status === "loading"
          ? "세션 확인 중"
          : activeUserId === "guest"
            ? "guest 모드"
            : `@${activeUserId}로 대화 중`;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-line bg-surface-muted/75 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
            <span className="relative h-3 w-3 rounded-full bg-accent" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              터프봇 실시간 대화
            </p>
            <p className="text-xs text-muted">{phaseLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetConversation}
          className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
        >
          대화 초기화
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              void submitMessage(prompt);
            }}
            disabled={isBusy}
            className="rounded-full border border-line bg-surface-strong px-4 py-2 text-sm text-foreground transition-colors hover:border-accent-soft hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[30px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(244,246,241,0.94)_100%)]">
        <div
          ref={transcriptRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";
            const bubbleClass = [
              "max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_12px_40px_-32px_rgba(31,42,40,0.75)]",
              isAssistant
                ? message.state === "error"
                  ? "border border-danger-ink/20 bg-danger-soft text-danger-ink"
                  : "border border-line bg-surface-strong text-foreground"
                : "bg-accent text-white",
            ].join(" ");

            return (
              <div
                key={message.id}
                className={[
                  "flex flex-col",
                  isAssistant ? "items-start" : "items-end",
                ].join(" ")}
              >
                <div className={bubbleClass}>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-current/70">
                    {message.sender}
                  </p>

                  {message.state === "thinking" && !message.text ? (
                    <ThinkingDots />
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                      {message.text}
                    </p>
                  )}
                </div>

                <span className="mt-2 px-1 text-xs text-muted/80">
                  {formatTime(message.createdAt)}
                </span>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage();
          }}
          className="border-t border-line bg-white/55 p-4 sm:p-5"
        >
          <div className="rounded-[26px] border border-line bg-surface-strong p-3 shadow-[0_18px_50px_-36px_rgba(31,42,40,0.7)]">
            <textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder="예: 오늘 터프 분위기 어때?"
              rows={3}
              disabled={isBusy}
              className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-7 text-foreground outline-none placeholder:text-muted/70 disabled:cursor-not-allowed"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div className="space-y-1">
                <p className="text-xs text-muted">
                  Enter로 전송, Shift+Enter로 줄바꿈
                </p>
                {errorMessage ? (
                  <p className="text-xs text-danger-ink">{errorMessage}</p>
                ) : (
                  <p className="text-xs text-muted">
                    `userId`는 현재 로그인 계정이 있으면 그 값을, 없으면 guest로
                    전송해.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!composer.trim() || isBusy}
                className="inline-flex min-w-28 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:bg-accent/45"
              >
                {phase === "waiting"
                  ? "생성 중..."
                  : phase === "streaming"
                    ? "출력 중..."
                    : "보내기"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
