import { cn } from "./cn";

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  wide?: boolean;
}

export function Container({ wide, ...props }: ContainerProps) {
  return (
    <div
      {...props}
      className={cn(
        "container standard-dialog rounded-sm mx-auto p-[10px] bg-white w-(--container-width)",
        wide && "lg:w-[calc(2*var(--container-width))]",
        props.className,
      )}
    />
  );
}
