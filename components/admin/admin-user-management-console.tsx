"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserStatus,
  type AdminUserCreateRequest,
  type AdminUserListStatus,
  type AdminUserRecord,
  type AdminUserStatus,
  type AdminUserUpdateRequest,
} from "@/lib/api/user";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type SearchFilterState = {
  keyword: string;
  status: AdminUserListStatus;
};

type CreateFormState = AdminUserCreateRequest;

type EditFormState = AdminUserUpdateRequest;

const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const SEARCH_FILTER_DEFAULT: SearchFilterState = {
  keyword: "",
  status: "ALL",
};

const CREATE_FORM_DEFAULT: CreateFormState = {
  userId: "",
  password: "",
  name: "",
  race: "TERRAN",
  tier: "",
};

const EDIT_FORM_DEFAULT: EditFormState = {
  userId: "",
  name: "",
  race: "TERRAN",
  tier: "",
};

const RACE_OPTIONS = ["TERRAN", "ZERG", "PROTOSS", "RANDOM"] as const;

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

function getStatusBadgeClassName(status: AdminUserStatus) {
  return status === "INACTIVE"
    ? "border border-danger-ink/15 bg-danger-soft text-danger-ink"
    : "border border-success-ink/15 bg-success-soft text-success-ink";
}

function getStatusLabel(status: AdminUserStatus) {
  return status === "INACTIVE" ? "비활성" : "활성";
}

function chooseSelectedUserId(
  users: AdminUserRecord[],
  preferredUserId: number | null,
  currentSelectedUserId: number | null,
) {
  if (
    typeof preferredUserId === "number" &&
    users.some((user) => user.id === preferredUserId)
  ) {
    return preferredUserId;
  }

  if (
    typeof currentSelectedUserId === "number" &&
    users.some((user) => user.id === currentSelectedUserId)
  ) {
    return currentSelectedUserId;
  }

  return users[0]?.id ?? null;
}

function validateCreateForm(form: CreateFormState) {
  if (!form.userId.trim()) {
    return "userId를 입력해 주세요.";
  }

  if (!form.password.trim()) {
    return "비밀번호를 입력해 주세요.";
  }

  if (!form.name.trim()) {
    return "이름을 입력해 주세요.";
  }

  if (!form.race.trim()) {
    return "종족을 선택해 주세요.";
  }

  if (!form.tier.trim()) {
    return "티어를 입력해 주세요.";
  }

  return null;
}

function validateEditForm(form: EditFormState) {
  if (!form.userId.trim()) {
    return "userId를 입력해 주세요.";
  }

  if (!form.name.trim()) {
    return "이름을 입력해 주세요.";
  }

  if (!form.race.trim()) {
    return "종족을 선택해 주세요.";
  }

  if (!form.tier.trim()) {
    return "티어를 입력해 주세요.";
  }

  return null;
}

export function AdminUserManagementConsole() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchForm, setSearchForm] = useState<SearchFilterState>(SEARCH_FILTER_DEFAULT);
  const [appliedFilters, setAppliedFilters] =
    useState<SearchFilterState>(SEARCH_FILTER_DEFAULT);
  const [createForm, setCreateForm] = useState<CreateFormState>(CREATE_FORM_DEFAULT);
  const [editForm, setEditForm] = useState<EditFormState>(EDIT_FORM_DEFAULT);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const preferredSelectedUserIdRef = useRef<number | null>(null);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoadingUsers(true);

      try {
        const nextUsers = await listAdminUsers(appliedFilters);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setUsers(nextUsers);
          setSelectedUserId((currentSelectedUserId) =>
            chooseSelectedUserId(
              nextUsers,
              preferredSelectedUserIdRef.current,
              currentSelectedUserId,
            ),
          );
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
          preferredSelectedUserIdRef.current = null;
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, refreshKey]);

  useEffect(() => {
    if (!selectedUser) {
      setEditForm(EDIT_FORM_DEFAULT);
      return;
    }

    setEditForm({
      userId: selectedUser.userId,
      name: selectedUser.name ?? "",
      race: selectedUser.race ?? "TERRAN",
      tier: selectedUser.tier ?? "",
    });
  }, [selectedUser]);

  function requestRefresh(nextSelectedUserId?: number | null) {
    preferredSelectedUserIdRef.current =
      typeof nextSelectedUserId === "number" ? nextSelectedUserId : null;
    setRefreshKey((current) => current + 1);
  }

  async function handleCreateUser() {
    const validationError = validateCreateForm(createForm);

    if (validationError) {
      setNotice({
        tone: "error",
        text: validationError,
      });
      return;
    }

    setPendingAction("create-user");
    setNotice(null);

    try {
      const createdUser = await createAdminUser({
        userId: createForm.userId.trim(),
        password: createForm.password.trim(),
        name: createForm.name.trim(),
        race: createForm.race,
        tier: createForm.tier.trim(),
      });

      setCreateForm(CREATE_FORM_DEFAULT);
      setSearchForm(SEARCH_FILTER_DEFAULT);
      setAppliedFilters(SEARCH_FILTER_DEFAULT);
      setNotice({
        tone: "success",
        text: `사용자 ${createdUser.userId}를 등록했습니다.`,
      });
      requestRefresh(createdUser.id);
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateUser() {
    if (!selectedUser) {
      setNotice({
        tone: "error",
        text: "수정할 사용자를 먼저 선택해 주세요.",
      });
      return;
    }

    const validationError = validateEditForm(editForm);

    if (validationError) {
      setNotice({
        tone: "error",
        text: validationError,
      });
      return;
    }

    setPendingAction("update-user");
    setNotice(null);

    try {
      const updatedUser = await updateAdminUser(selectedUser.id, {
        userId: editForm.userId.trim(),
        name: editForm.name.trim(),
        race: editForm.race,
        tier: editForm.tier.trim(),
      });

      setNotice({
        tone: "success",
        text: `사용자 ${updatedUser.userId} 정보를 수정했습니다.`,
      });
      requestRefresh(updatedUser.id);
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleToggleUserStatus() {
    if (!selectedUser) {
      setNotice({
        tone: "error",
        text: "상태를 변경할 사용자를 먼저 선택해 주세요.",
      });
      return;
    }

    const nextStatus: AdminUserStatus =
      selectedUser.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setPendingAction("toggle-status");
    setNotice(null);

    try {
      const updatedUser = await updateAdminUserStatus(selectedUser.id, nextStatus);

      setNotice({
        tone: "success",
        text:
          nextStatus === "ACTIVE"
            ? `사용자 ${updatedUser.userId}를 재활성화했습니다.`
            : `사용자 ${updatedUser.userId}를 비활성화했습니다.`,
      });
      requestRefresh(updatedUser.id);
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Users
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              사용자 관리
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              userId 기준으로 사용자 목록을 찾고, 등록과 수정, 비활성화와 재활성화를
              같은 화면에서 처리한다.
            </p>
          </div>

          <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-3 text-sm text-muted">
            현재 목록 {users.length}명
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-5 rounded-2xl px-4 py-3 text-sm leading-7",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <SurfaceCard className="p-6">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice(null);
                setAppliedFilters({
                  keyword: searchForm.keyword.trim(),
                  status: searchForm.status,
                });
              }}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    userId 검색
                  </span>
                  <Input
                    value={searchForm.keyword}
                    onChange={(event) => {
                      setSearchForm((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }));
                    }}
                    placeholder="userId 입력"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    상태 필터
                  </span>
                  <select
                    className={SELECT_CLASS_NAME}
                    value={searchForm.status}
                    onChange={(event) => {
                      setSearchForm((current) => ({
                        ...current,
                        status: event.target.value as AdminUserListStatus,
                      }));
                    }}
                  >
                    <option value="ALL">전체</option>
                    <option value="ACTIVE">활성</option>
                    <option value="INACTIVE">비활성</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="accent" disabled={loadingUsers}>
                  검색
                </Button>
                <Button
                  type="button"
                  disabled={loadingUsers}
                  onClick={() => {
                    setNotice(null);
                    setSearchForm(SEARCH_FILTER_DEFAULT);
                    setAppliedFilters(SEARCH_FILTER_DEFAULT);
                  }}
                >
                  초기화
                </Button>
              </div>
            </form>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">사용자 목록</p>
                <p className="mt-1 text-sm text-muted">
                  userId 검색과 상태 필터 결과를 보여준다.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={loadingUsers}
                onClick={() => {
                  setNotice(null);
                  requestRefresh(selectedUserId);
                }}
              >
                새로고침
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {loadingUsers ? (
                <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                  사용자 목록을 불러오는 중이다.
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                  조건에 맞는 사용자가 없다.
                </div>
              ) : (
                <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const isSelected = user.id === selectedUserId;

                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "w-full rounded-[24px] border px-4 py-4 text-left transition-colors",
                          isSelected
                            ? "border-accent-soft bg-white shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]"
                            : "border-line bg-surface-strong hover:border-accent-soft hover:bg-white",
                          user.status === "INACTIVE" && "opacity-80",
                        )}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setNotice(null);
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-base font-semibold text-foreground">
                            {user.userId}
                          </p>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              getStatusBadgeClassName(user.status),
                            )}
                          >
                            {getStatusLabel(user.status)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            종족 {user.race || "-"}
                          </span>
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            이름 {user.name || "-"}
                          </span>
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            티어 {user.tier || "-"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">사용자 등록</p>
                <p className="mt-1 text-sm text-muted">
                  새 사용자를 바로 등록한다.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  userId
                </span>
                <Input
                  value={createForm.userId}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      userId: event.target.value,
                    }));
                  }}
                  placeholder="userId 입력"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  비밀번호
                </span>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }));
                  }}
                  placeholder="초기 비밀번호 입력"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    이름
                  </span>
                  <Input
                    value={createForm.name}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                    }}
                    placeholder="이름 입력"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    티어
                  </span>
                  <Input
                    value={createForm.tier}
                    onChange={(event) => {
                      setCreateForm((current) => ({
                        ...current,
                        tier: event.target.value,
                      }));
                    }}
                    placeholder="티어 입력"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  종족
                </span>
                <select
                  className={SELECT_CLASS_NAME}
                  value={createForm.race}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      race: event.target.value,
                    }));
                  }}
                >
                  {RACE_OPTIONS.map((race) => (
                    <option key={race} value={race}>
                      {race}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                variant="accent"
                fullWidth
                disabled={pendingAction !== null}
                onClick={() => {
                  void handleCreateUser();
                }}
              >
                {pendingAction === "create-user" ? "등록 중..." : "사용자 등록"}
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">사용자 수정</p>
                <p className="mt-1 text-sm text-muted">
                  목록에서 선택한 사용자 정보를 수정한다.
                </p>
              </div>
              {selectedUser ? (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    getStatusBadgeClassName(selectedUser.status),
                  )}
                >
                  {getStatusLabel(selectedUser.status)}
                </span>
              ) : null}
            </div>

            {!selectedUser ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                수정할 사용자를 왼쪽 목록에서 선택해 달라.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    userId
                  </span>
                  <Input
                    value={editForm.userId}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }));
                    }}
                    placeholder="userId 입력"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground">
                      이름
                    </span>
                    <Input
                      value={editForm.name}
                      onChange={(event) => {
                        setEditForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }));
                      }}
                      placeholder="이름 입력"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground">
                      티어
                    </span>
                    <Input
                      value={editForm.tier}
                      onChange={(event) => {
                        setEditForm((current) => ({
                          ...current,
                          tier: event.target.value,
                        }));
                      }}
                      placeholder="티어 입력"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    종족
                  </span>
                  <select
                    className={SELECT_CLASS_NAME}
                    value={editForm.race}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        race: event.target.value,
                      }));
                    }}
                  >
                    {RACE_OPTIONS.map((race) => (
                      <option key={race} value={race}>
                        {race}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="accent"
                    fullWidth
                    disabled={pendingAction !== null}
                    onClick={() => {
                      void handleUpdateUser();
                    }}
                  >
                    {pendingAction === "update-user" ? "수정 중..." : "사용자 수정"}
                  </Button>

                  <Button
                    type="button"
                    variant={selectedUser.status === "ACTIVE" ? "danger" : "outline"}
                    fullWidth
                    disabled={pendingAction !== null}
                    onClick={() => {
                      void handleToggleUserStatus();
                    }}
                  >
                    {pendingAction === "toggle-status"
                      ? "상태 변경 중..."
                      : selectedUser.status === "ACTIVE"
                        ? "비활성화"
                        : "재활성화"}
                  </Button>
                </div>
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
