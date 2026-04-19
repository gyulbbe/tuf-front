"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { buildLoginHref } from "@/lib/auth/auth-navigation";

export function HeaderAuthButton() {
  const pathname = usePathname();
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <span className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted/70">
        확인 중...
      </span>
    );
  }

  if (user) {
    return (
      <Link
        href="/me"
        className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
      >
        {user.username}
      </Link>
    );
  }

  return (
    <Link
      href={buildLoginHref({ redirectTo: pathname })}
      className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
    >
      로그인
    </Link>
  );
}
