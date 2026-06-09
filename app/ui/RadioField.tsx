import { cn } from "./cn";

export interface RadioFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * A single radio option styled by the global system.css rules in retro.css.
 * Group options by giving them the same `name`.
 */
export function RadioField({
  id,
  children,
  className,
  ...rest
}: RadioFieldProps) {
  return (
    <div className={cn("field-row flex items-center", className)}>
      <input type="radio" {...rest} id={id} />
      <label className="cursor-pointer select-none" htmlFor={id}>
        {children}
      </label>
    </div>
  );
}
