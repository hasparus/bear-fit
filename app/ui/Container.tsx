import { cn } from "./cn";

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  wide?: boolean;
}

export function Container({ wide, ...props }: ContainerProps) {
  return (
    <div
      {...props}
      className={cn(
        "container border mx-auto p-4 bg-white w-[340px]",
        wide && "lg:w-[680px]",
        props.className
      )}
    />
  );
}
