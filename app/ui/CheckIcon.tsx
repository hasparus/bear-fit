import { cn } from "./cn";

export interface CheckIconProps extends React.HTMLAttributes<HTMLDivElement> {
  checked: boolean;
}

/**
 * For use outside of forms.
 * Uses global styles from system.css.
 */
export function CheckIcon({ checked, className, ...rest }: CheckIconProps) {
  return (
    <div aria-hidden className={cn("relative", className)} {...rest}>
      <input type="checkbox" />
      <label
        className={
          checked
            ? "after:content-['x'] after:absolute after:left-[-16.66px] after:top-[-3px]"
            : ""
        }
      />
    </div>
  );
}
