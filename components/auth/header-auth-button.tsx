"use client";

import { startTransition, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

function formatRoleBadge(role: string | null | undefined) {
  if (!role) {
    return null;
  }

  return role.replace(/^ROLE_/, "") || null;
}

export function HeaderAuthButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <span className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted/70">
        확인 중...
      </span>
    );
  }

  if (user) {
    const roleBadge = formatRoleBadge(user.role);

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-foreground">
          {user.username}
          {roleBadge ? ` · ${roleBadge}` : ""}
        </span>
        <Button
          onClick={() => {
            logout();
            startTransition(() => {
              router.replace("/notice");
            });
          }}
        >
          로그아웃
        </Button>
      </div>
    );
  }

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/28 px-4 py-10 backdrop-blur-[2px] sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_80px_-40px_rgba(31,42,40,0.7)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    로그인
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    아이디와 비밀번호를 입력하면 바로 로그인된다.
                  </p>
                </div>

                <Button
                  onClick={() => setOpen(false)}
                  size="sm"
                  aria-label="닫기"
                >
                  닫기
                </Button>
              </div>

              <LoginForm
                redirectTo={pathname}
                onSuccess={() => setOpen(false)}
                showReturnLink={false}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
      >
        로그인
      </Button>

      {modal}
    </>
  );
}
