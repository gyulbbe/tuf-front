"use client";

import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  idleText: string;
  pendingText: string;
  pending?: boolean;
};

export function AuthSubmitButton({
  idleText,
  pendingText,
  pending: pendingOverride,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isPending = pendingOverride ?? pending;

  return (
    <button
      type="submit"
      disabled={isPending}
      className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:bg-accent/70"
    >
      {isPending ? pendingText : idleText}
    </button>
  );
}
