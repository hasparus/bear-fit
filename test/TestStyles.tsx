export function TestStyles({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <link href="https://unpkg.com/@sakun/system.css" rel="stylesheet" />
    </>
  );
}
