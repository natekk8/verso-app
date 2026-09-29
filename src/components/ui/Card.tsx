import React, { forwardRef } from "react";
import { cn } from "./utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  doubleBezel?: boolean;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, doubleBezel = false, interactive = false, children, ...props }, ref) => {
    if (doubleBezel) {
      return (
        <div
          ref={ref}
          className={cn(
            "p-1 rounded-2xl bg-white/[0.02] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-200",
            interactive && "hover:border-white/20 active:scale-[0.99] cursor-pointer",
            className
          )}
          {...props}
        >
          <div className="rounded-xl bg-neutral-900/80 border border-white/5 p-5 md:p-6 backdrop-blur-md h-full">
            {children}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl bg-neutral-900/60 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.36)] backdrop-blur-xl transition-all duration-200 p-5 md:p-6",
          interactive && "hover:border-white/20 hover:bg-neutral-900/80 active:scale-[0.99] cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold tracking-tight text-white", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-neutral-400 leading-relaxed", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center pt-4 border-t border-white/5", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
