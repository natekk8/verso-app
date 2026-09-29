import React from "react";
import { cn } from "./utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "emerald" | "amber" | "rose" | "neutral" | "cyan" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "neutral",
  size = "sm",
  dot = false,
  pulse = false,
  children,
  ...props
}) => {
  const variantStyles = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    neutral: "bg-white/[0.04] text-neutral-300 border-white/10",
    outline: "bg-transparent text-neutral-300 border-white/20",
  };

  const dotColors = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    cyan: "bg-cyan-400",
    neutral: "bg-neutral-400",
    outline: "bg-neutral-400",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1.5",
    md: "px-2.5 py-1 text-xs gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border tracking-wide uppercase font-mono",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                dotColors[variant]
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-1.5 w-1.5",
              dotColors[variant]
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
};
