import { type TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors",
        "placeholder:text-muted focus:border-accent-soft focus:bg-white aria-invalid:border-danger-ink/50",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
