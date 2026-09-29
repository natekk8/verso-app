import React, { forwardRef } from "react";
import { cn } from "./utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glass";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium select-none transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]";

    const variantStyles = {
      primary:
        "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)] border border-emerald-400/30",
      secondary:
        "bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 hover:text-white border border-white/10 shadow-sm",
      glass:
        "bg-neutral-900/60 hover:bg-neutral-800/70 text-neutral-200 hover:text-white border border-white/10 backdrop-blur-md shadow-md",
      ghost:
        "bg-transparent hover:bg-white/[0.06] text-neutral-400 hover:text-white",
      danger:
        "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-12 px-6 text-base rounded-xl gap-2.5",
      icon: "h-10 w-10 p-0 rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
