import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const variantClassNames = {
  accent: "bg-accent text-white hover:bg-accent-ink disabled:bg-accent/70",
  danger:
    "border border-danger-ink/20 bg-danger-soft text-danger-ink hover:border-danger-ink/40",
  outline:
    "border border-line text-muted hover:border-accent-soft hover:bg-surface-strong hover:text-foreground",
} as const;

const sizeClassNames = {
  md: "px-5 py-3 text-sm",
  sm: "px-4 py-2 text-sm",
} as const;

type ButtonVariant = keyof typeof variantClassNames;
type ButtonSize = keyof typeof sizeClassNames;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      fullWidth = false,
      size = "md",
      type = "button",
      variant = "outline",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-70",
        fullWidth && "w-full",
        sizeClassNames[size],
        variantClassNames[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
