import { CheckboxField } from "./ui/CheckboxField";
import { GitHubIcon } from "./ui/GitHubIcon";
import { useUserDispatch, useUserState } from "./ui/UserStateContext";

export function AppFooter() {
  const { nerdMode } = useUserState();
  const dispatch = useUserDispatch();

  // todo: the footer should only show on hover or drag from the bottom on mobile
  // actually, let's ditch the footer and add menu icon that opens a modal
  return (
    <footer className="px-2 pt-1 window w-[calc(100vw-40px)] ![box-shadow:2px_1px] !mb-[-1px] pb-2">
      <div className="title-bar">
        <h2 className="title">bear fit</h2>
      </div>

      <div className="max-w-[600px] text-sm mx-auto mt-8 text-pretty [&_a]:hover:!text-accent">
        {/* todo: stats */}
        <p className="mb-6">
          Finding a time that works for more than two adult humans is{" "}
          <strong>unbearable</strong>. Bear Fit is a tiny app that hopes to
          help. It's a small tool designed to be used and forgotten until the
          next time you need it.
        </p>
        <h3 className="mb-6 font-sans">Motivation and Alternatives</h3>
        <ul className="list-inside *:mb-6">
          <li>
            <span className="dark:invert-100">✏️</span> Doodle was bad, now it's
            bad, corporate, and has too many features.
          </li>
          <li>
            <span className="dark:invert-100">🦀</span> My friends' big paws
            were too clumsy to use <a href="https://crab.fit/">crab.fit</a> on
            phones. Ben seems like a cool guy tho, so please use app if you want
            to select hours with pincerlike precision.
          </li>
          <li>
            <span className="dark:invert-100">📅</span> You probably wanna use{" "}
            <a href="https://cal.com">cal.com</a> if you need something like
            this but better, and built by an actual business.
          </li>
        </ul>
        <h3 className="mb-6 font-sans">Other Bears</h3>
        <p className="mb-6">
          <span className="font-sans">bear fit</span> has no connection to{" "}
          <a href="https://bearblog.dev/">Bear</a> the blog platform apart from
          the programmer's affinity for bad puns. It is also not affiliated with{" "}
          <a href="https://www.bear.app/">Bear</a>&nbsp;the note-taking app.
        </p>
        <h3 className="mb-6 font-sans">Mea Culpa</h3>
        <p className="mb-6">
          Bear Fit was built by me,{" "}
          <a href="https://haspar.us/">Piotr Monwid-Olechnowicz</a>{" "}
          <span className="dark:invert-100">👋</span>
        </p>
        <p className="mb-6">
          The code is open source, so if you'd like to open an issue, fix an
          issue, or fork it to make your own little scheduling app, you can find{" "}
          <a href="https://github.com/hasparus/bear-fit">
            the repo on GitHub
            <GitHubIcon className="size-4 inline ml-1 mb-px" />
          </a>
        </p>
        <hr />
        <section>
          <h3 className="font-sans mt-4">Settings</h3>
          <form className="mt-2">
            <CheckboxField
              checked={nerdMode}
              id="nerd-mode"
              onChange={(e) => {
                dispatch({ type: "set-nerd-mode", payload: e.target.checked });
              }}
            >
              Nerd Mode
              {/* todo: explain nerd mode, show last commit hash */}
            </CheckboxField>
          </form>
        </section>
      </div>
    </footer>
  );
}
