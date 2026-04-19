"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

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
    <Button
      type="submit"
      disabled={isPending}
      variant="accent"
      fullWidth
    >
      {isPending ? pendingText : idleText}
    </Button>
  );
}
