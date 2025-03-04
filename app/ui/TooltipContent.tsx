import { cn } from "./cn";

export function TooltipContent({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap pointer-events-none font-mono",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
