import { forwardRef } from "react";

import { cn } from "./cn";

export interface TooltipContentProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const TooltipContent = forwardRef<HTMLSpanElement, TooltipContentProps>(
  function TooltipContent({ children, className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black text-white text-xs py-1 px-2 rounded-sm whitespace-nowrap pointer-events-none font-mono z-50",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
