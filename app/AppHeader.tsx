import { cn } from "./ui/cn";
import { GitHubIcon } from "./ui/GitHubIcon";
import { useUserState } from "./ui/UserStateContext";

export function AppHeader({ className }: { className?: string }) {
  const { events } = useUserState();

  return (
    <header
      className={cn(
        "sticky w-full top-0 z-50 flex items-center justify-between px-3 py-1 border-b border-neutral-300 bg-white",
        className,
      )}
    >
      <a
        className="font-sans text-sm font-bold no-underline text-inherit"
        href="/"
      >
        bear fit
      </a>
      <nav className="flex items-center gap-2">
        {events.length > 0 && (
          <a
            className="font-mono text-xs text-neutral-500 hover:text-neutral-800 no-underline"
            href="#footer"
          >
            [your events]
          </a>
        )}
        <a
          aria-label="GitHub"
          className="text-neutral-500 hover:text-neutral-800"
          href="https://github.com/hasparus/bear-fit"
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHubIcon className="size-4" />
        </a>
      </nav>
    </header>
  );
}
