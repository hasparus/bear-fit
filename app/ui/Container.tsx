import { cn } from "./cn";

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  wide?: boolean;
}

export function Container({ wide, ...props }: ContainerProps) {
  return (
    <div
      {...props}
      className={cn(
        "container standard-dialog rounded-sm mx-auto p-4 bg-white w-(--container-width) max-sm:!w-[calc(100vw-1rem)] max-sm:!mx-2",
        wide && "lg:w-[calc(2*var(--container-width))] max-sm:!w-[calc(100vw-1rem)]",
        props.className,
      )}
    />
  );
}
