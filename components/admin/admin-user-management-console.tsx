"use client";

import {
  startTransition,
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminUserCreateRequest,
  type AdminUserListStatus,
  type AdminUserRecord,
  type AdminUserRole,
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
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

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
const ROLE_OPTIONS: readonly AdminUserRole[] = [
  "ROLE_USER",
  "ROLE_MANAGER",
  "ROLE_MASTER",
  "ROLE_ADMIN",
];

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

function getRoleLabel(role: AdminUserRole | string | null | undefined) {
  switch (role) {
    case "ROLE_MANAGER":
      return "매니저";
    case "ROLE_MASTER":
      return "마스터";
    case "ROLE_ADMIN":
      return "관리자";
    default:
      return "일반";
  }
}

function getRoleBadgeClassName(role: AdminUserRole | string | null | undefined) {
  switch (role) {
    case "ROLE_MANAGER":
      return "border border-accent/20 bg-accent-soft text-accent-ink";
    case "ROLE_MASTER":
      return "border border-success-ink/15 bg-success-soft text-success-ink";
    case "ROLE_ADMIN":
      return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
    default:
      return "border border-line bg-surface-muted text-foreground";
  }
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

function userMatchesFilters(
  user: AdminUserRecord,
  filters: SearchFilterState,
) {
  const keyword = filters.keyword.trim().toLowerCase();
  const matchesKeyword =
    !keyword ||
    user.userId.toLowerCase().includes(keyword) ||
    (user.name ?? "").toLowerCase().includes(keyword);
  const matchesStatus = filters.status === "ALL" || user.status === filters.status;

  return matchesKeyword && matchesStatus;
}

function validateCreateForm(form: CreateFormState) {
  if (!form.userId.trim()) {
    return "아이디를 입력해 주세요.";
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
    return "아이디를 입력해 주세요.";
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
  const [roleForm, setRoleForm] = useState<AdminUserRole>("ROLE_USER");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rightColumnHeight, setRightColumnHeight] = useState<number | null>(null);
  const preferredSelectedUserIdRef = useRef<number | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? null;
  const managementLayoutStyle = rightColumnHeight
    ? ({
        "--admin-user-right-column-height": `${rightColumnHeight}px`,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    const rightColumn = rightColumnRef.current;

    if (!rightColumn) {
      return;
    }

    const updateRightColumnHeight = () => {
      setRightColumnHeight(Math.ceil(rightColumn.getBoundingClientRect().height));
    };

    updateRightColumnHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRightColumnHeight);

      return () => {
        window.removeEventListener("resize", updateRightColumnHeight);
      };
    }

    const observer = new ResizeObserver(updateRightColumnHeight);
    observer.observe(rightColumn);

    return () => {
      observer.disconnect();
    };
  }, []);

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
    startTransition(() => {
      if (!selectedUser) {
        setEditForm(EDIT_FORM_DEFAULT);
        setRoleForm("ROLE_USER");
        return;
      }

      setEditForm({
        userId: selectedUser.userId,
        name: selectedUser.name ?? "",
        race: selectedUser.race ?? "TERRAN",
        tier: selectedUser.tier ?? "",
      });
      setRoleForm(selectedUser.userType);
    });
  }, [selectedUser]);

  function requestRefresh(nextSelectedUserId?: number | null) {
    preferredSelectedUserIdRef.current =
      typeof nextSelectedUserId === "number" ? nextSelectedUserId : null;
    setRefreshKey((current) => current + 1);
  }

  function applyUserUpdate(updatedUser: AdminUserRecord) {
    const matchesCurrentFilters = userMatchesFilters(updatedUser, appliedFilters);

    setUsers((currentUsers) => {
      if (!matchesCurrentFilters) {
        return currentUsers.filter((user) => user.id !== updatedUser.id);
      }

      const hasExistingUser = currentUsers.some(
        (user) => user.id === updatedUser.id,
      );

      if (!hasExistingUser) {
        return [updatedUser, ...currentUsers];
      }

      return currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      );
    });
    setSelectedUserId(matchesCurrentFilters ? updatedUser.id : null);
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
      setUsers((currentUsers) => [
        createdUser,
        ...currentUsers.filter((user) => user.id !== createdUser.id),
      ]);
      setSelectedUserId(createdUser.id);
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
      applyUserUpdate(updatedUser);
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
      applyUserUpdate(updatedUser);
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateUserRole() {
    if (!selectedUser) {
      setNotice({
        tone: "error",
        text: "권한을 변경할 사용자를 먼저 선택해 주세요.",
      });
      return;
    }

    if (selectedUser.userType === roleForm) {
      setNotice({
        tone: "neutral",
        text: "이미 선택한 권한으로 설정되어 있습니다.",
      });
      return;
    }

    setPendingAction("update-role");
    setNotice(null);

    try {
      const updatedUser = await updateAdminUserRole(selectedUser.id, roleForm);

      setNotice({
        tone: "success",
        text: `사용자 ${updatedUser.userId} 권한을 ${getRoleLabel(updatedUser.userType)}로 변경했습니다.`,
      });
      applyUserUpdate(updatedUser);
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
              아이디 기준으로 사용자 목록을 찾고, 등록과 수정, 비활성화와 재활성화를
              같은 화면에서 처리한다.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-surface-strong px-4 py-3 text-sm text-muted">
            현재 목록 {users.length}명
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-5 rounded-lg px-4 py-3 text-sm leading-7",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}
      </SurfaceCard>

      <div
        className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(440px,0.8fr)]"
        style={managementLayoutStyle}
      >
        <div className="flex min-h-0 flex-col gap-4 xl:h-[var(--admin-user-right-column-height)]">
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
                    아이디 검색
                  </span>
                  <Input
                    value={searchForm.keyword}
                    onChange={(event) => {
                      setSearchForm((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }));
                    }}
                    placeholder="아이디 검색"
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

          <SurfaceCard className="flex min-h-0 flex-1 flex-col p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">사용자 목록</p>
                <p className="mt-1 text-sm text-muted">
                  아이디 검색과 상태 필터 결과를 보여준다.
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

            <div className="mt-5 flex min-h-0 flex-1 flex-col">
              {loadingUsers ? (
                <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                  사용자 목록을 불러오는 중이다.
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                  조건에 맞는 사용자가 없다.
                </div>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const isSelected = user.id === selectedUserId;

                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-4 py-4 text-left transition-colors",
                          isSelected
                            ? "border-accent-soft bg-white shadow-[0_16px_50px_rgba(23,33,43,0.08)]"
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
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold",
                                getRoleBadgeClassName(user.userType),
                              )}
                            >
                              {getRoleLabel(user.userType)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-xs font-semibold",
                                getStatusBadgeClassName(user.status),
                              )}
                            >
                              {getStatusLabel(user.status)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            {user.race || "-"}
                          </span>
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            {user.name || "-"}
                          </span>
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            티어 {user.tier || "-"}
                          </span>
                          <span className="rounded-full bg-surface-muted px-3 py-1">
                            권한 {getRoleLabel(user.userType)}
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

        <div ref={rightColumnRef} className="space-y-4">
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
                  아이디
                </span>
                <Input
                  value={createForm.userId}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      userId: event.target.value,
                    }));
                  }}
                  placeholder="아이디 입력"
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

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      getStatusBadgeClassName(selectedUser.status),
                    )}
                  >
                    {getStatusLabel(selectedUser.status)}
                  </span>
                </div>
              ) : null}
            </div>

            {!selectedUser ? (
              <div className="mt-5 rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                수정할 사용자를 왼쪽 목록에서 선택해 달라.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    아이디
                  </span>
                  <Input
                    value={editForm.userId}
                    onChange={(event) => {
                      setEditForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }));
                    }}
                    placeholder="아이디 입력"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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

                <div className="rounded-lg border border-line bg-surface-strong px-4 py-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-foreground">
                      권한
                    </span>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={roleForm}
                      onChange={(event) => {
                        setRoleForm(event.target.value as AdminUserRole);
                      }}
                      disabled={pendingAction !== null}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {getRoleLabel(role)} ({role})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-6 text-muted">
                      현재 권한은 {getRoleLabel(selectedUser.userType)}입니다.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        pendingAction !== null || selectedUser.userType === roleForm
                      }
                      onClick={() => {
                        void handleUpdateUserRole();
                      }}
                    >
                      {pendingAction === "update-role" ? "권한 변경 중..." : "권한 변경"}
                    </Button>
                  </div>
                </div>

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
