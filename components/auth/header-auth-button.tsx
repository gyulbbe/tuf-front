"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <span className="inline-flex rounded-full border border-line-strong bg-white px-4 py-2 text-sm text-muted/70">
        확인 중...
      </span>
    );
  }

  if (user) {
    const roleBadge = formatRoleBadge(user.role);
    const isAccountPage = pathname === "/me" || pathname.startsWith("/me/");

    return (
      <div className="flex items-center gap-2">
        <Link
          href="/me"
          className={cn(
            "inline-flex rounded-full border px-4 py-2 text-sm transition-colors",
            isAccountPage
              ? "border-accent bg-accent-soft text-accent-ink"
              : "border-line-strong bg-white text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent-ink",
          )}
        >
          {user.username}
          {roleBadge ? ` · ${roleBadge}` : ""}
        </Link>
        <Button
          onClick={() => {
            logout();
            startTransition(() => {
              router.replace("/gallery");
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
              className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-[0_16px_50px_rgba(23,33,43,0.12)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    로그인
                  </h2>
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
      <Button onClick={() => setOpen(true)}>로그인</Button>

      {modal}
    </>
  );
}
