import { cn } from "./cn";

export interface CheckboxFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function CheckboxField({
  id,
  children,
  className,
  ...rest
}: CheckboxFieldProps) {
  return (
    <div className={cn("field-row flex items-center", className)}>
      <input type="checkbox" {...rest} id={id} />
      <label
        className="cursor-pointer [input:checked+&]:after:content-['x'] after:bg-none  after:absolute after:left-[-16.66px] after:top-[3px] py-1 w-full leading-[14px] select-none"
        htmlFor={id}
      >
        {children}
      </label>
    </div>
  );
}
