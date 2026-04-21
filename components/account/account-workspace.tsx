"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserDetail, updateUserPassword, type UserDetail } from "@/lib/api/user";
import { cn } from "@/lib/utils";

type AccountTab = {
  description: string;
  id: string;
  label: string;
};

type NoticeTone = "error" | "neutral" | "success";

type NoticeState = {
  text: string;
  tone: NoticeTone;
};

const ACCOUNT_TABS: AccountTab[] = [
  {
    id: "account",
    label: "계정",
    description: "기본 정보와 비밀번호 변경",
  },
];

const INITIAL_PASSWORD_FORM = {
  confirmPassword: "",
  newPassword: "",
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function getNoticeClassName(tone: NoticeTone) {
  switch (tone) {
    case "error":
      return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
    case "success":
      return "border border-success-ink/15 bg-success-soft text-success-ink";
    default:
      return "border border-line bg-surface-muted text-foreground";
  }
}

function AccountNotice({ notice }: { notice: NoticeState }) {
  return (
    <p
      className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-7",
        getNoticeClassName(notice.tone),
      )}
    >
      {notice.text}
    </p>
  );
}

function validatePasswordForm(newPassword: string, confirmPassword: string) {
  if (!newPassword.trim()) {
    return "새 비밀번호를 입력해 주세요.";
  }

  if (newPassword.length < 4) {
    return "새 비밀번호는 4자 이상 입력해 주세요.";
  }

  if (newPassword !== confirmPassword) {
    return "새 비밀번호 확인이 일치하지 않습니다.";
  }

  return null;
}

export function AccountWorkspace() {
  const { status, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTab["id"]>("account");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailNotice, setDetailNotice] = useState<NoticeState | null>(null);
  const [formNotice, setFormNotice] = useState<NoticeState | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);

  useEffect(() => {
    if (status !== "authenticated" || !user?.username) {
      return;
    }

    const username = user.username;
    let cancelled = false;

    async function loadDetail() {
      setIsLoadingDetail(true);
      setDetailNotice(null);

      try {
        const nextDetail = await getUserDetail(username);

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetail(null);
        setDetailNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [status, user?.username]);

  const activeTabMeta =
    ACCOUNT_TABS.find((tab) => tab.id === activeTab) ?? ACCOUNT_TABS[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          내 계정
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          상단 우측 사용자 아이디를 눌렀을 때 들어오는 계정 전용 화면이다. 현재는
          계정 탭만 두고, 이후 다른 탭을 같은 자리에서 확장할 수 있게 구성했다.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {ACCOUNT_TABS.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-[24px] border px-5 py-4 text-left transition-colors",
                  isActive
                    ? "border-accent-soft bg-white text-foreground shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]"
                    : "border-line bg-surface-strong text-muted hover:border-accent-soft hover:bg-white hover:text-foreground",
                )}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="mt-2 text-sm leading-6">{tab.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-[26px] border border-line bg-surface-strong p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeTabMeta.label}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                {activeTabMeta.description}
              </p>
            </div>

            <Button
              type="button"
              variant={isPasswordFormOpen ? "outline" : "accent"}
              onClick={() => {
                setFormNotice(null);
                setIsPasswordFormOpen((current) => !current);
              }}
            >
              {isPasswordFormOpen ? "변경 폼 닫기" : "비밀번호 변경"}
            </Button>
          </div>

          {detailNotice ? (
            <div className="mt-5">
              <AccountNotice notice={detailNotice} />
            </div>
          ) : null}

          {isLoadingDetail ? (
            <div className="mt-5 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              계정 정보를 불러오는 중입니다.
            </div>
          ) : detail ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  ID
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.userId}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  이름
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.name || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  티어
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.tier || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  종족
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.race || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  배틀태그
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.battleTag || "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface-muted/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  코인
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {detail.coin ?? 0}
                </p>
              </div>
            </div>
          ) : null}

          {isPasswordFormOpen ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-line bg-surface-muted/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    비밀번호 변경
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    현재 백엔드 규칙에 맞춰 새 비밀번호만 전송한다.
                  </p>
                </div>
              </div>

              {formNotice ? (
                <div className="mt-4">
                  <AccountNotice notice={formNotice} />
                </div>
              ) : null}

              <form
                className="mt-4 space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();

                  if (status !== "authenticated" || !user) {
                    setFormNotice({
                      tone: "error",
                      text: "로그인 상태를 확인하지 못했습니다.",
                    });
                    return;
                  }

                  const validationError = validatePasswordForm(
                    passwordForm.newPassword,
                    passwordForm.confirmPassword,
                  );

                  if (validationError) {
                    setFormNotice({
                      tone: "error",
                      text: validationError,
                    });
                    return;
                  }

                  setIsChangingPassword(true);
                  setFormNotice(null);

                  try {
                    await updateUserPassword(user.userPk, passwordForm.newPassword);
                    setPasswordForm(INITIAL_PASSWORD_FORM);
                    setIsPasswordFormOpen(false);
                    setDetailNotice({
                      tone: "success",
                      text: "비밀번호를 변경했습니다.",
                    });
                    setFormNotice(null);
                  } catch (error) {
                    const message = readErrorMessage(error);

                    setFormNotice({
                      tone: "error",
                      text: message,
                    });

                    if (typeof window !== "undefined") {
                      window.alert(message);
                    }
                  } finally {
                    setIsChangingPassword(false);
                  }
                }}
              >
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    새 비밀번호
                  </span>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    placeholder="새 비밀번호를 입력해 주세요."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    새 비밀번호 확인
                  </span>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="같은 비밀번호를 다시 입력해 주세요."
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setPasswordForm(INITIAL_PASSWORD_FORM);
                      setIsPasswordFormOpen(false);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    variant="accent"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">계정 메뉴</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <p>상단 우측 사용자 아이디를 누르면 이 화면으로 들어온다.</p>
            <p>이 화면 안에 계정용 탭을 계속 추가할 수 있게 구조를 분리해뒀다.</p>
            <p>현재는 비밀번호 변경 기능이 먼저 연결되어 있다.</p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 로그인</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <p>
              아이디{" "}
              <span className="font-medium text-foreground">
                {user?.username ?? "-"}
              </span>
            </p>
            <p>
              권한{" "}
              <span className="font-medium text-foreground">
                {user?.role ?? "-"}
              </span>
            </p>
            <p>
              사용자 PK{" "}
              <span className="font-medium text-foreground">
                {user?.userPk ?? "-"}
              </span>
            </p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
