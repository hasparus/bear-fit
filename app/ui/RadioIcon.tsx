export interface RadioIconProps extends React.HTMLAttributes<HTMLDivElement> {
  checked: boolean;
}

/**
 * For use outside of forms.
 * Uses global styles from system.css.
 */
export function RadioIcon({ checked, ...rest }: RadioIconProps) {
  return (
    <div aria-hidden {...rest}>
      <input type="radio" checked={checked} />
      <label />
    </div>
  );
}
