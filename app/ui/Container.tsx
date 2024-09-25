import { cn } from "./cn";

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {}

export function Container(props: ContainerProps) {
  return (
    <div
      {...props}
      className={cn(
        "container border mx-auto p-4 bg-white w-min",
        props.className
      )}
    />
  );
}
