import { CheckboxField } from "./ui/CheckboxField";
import { useUserDispatch, useUserState } from "./ui/UserStateContext";

export function AppFooter() {
  const { nerdMode } = useUserState();
  const dispatch = useUserDispatch();

  // todo: the footer should only show on hover or drag from the bottom on mobile
  // actually, let's ditch the footer and add menu icon that opens a modal
  return (
    <footer className="overflow-hidden px-2 pt-1 window w-[calc(100vw-40px)] ![box-shadow:2px_1px] !mb-[-1px] pb-2">
      <div className="title-bar">
        <h2 className="title">bear fit</h2>
      </div>

      <div className="max-w-[600px] text-sm mx-auto mt-8">
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
            ✏️ Doodle was bad, now it's bad, corporate, and has too many
            features.
          </li>
          <li>
            🦀 My friends' big paws were too clumsy to use{" "}
            <a href="https://crab.fit/">crab.fit</a> on phones, so I made this
            instead. Ben seems like a cool guy tho, so please use app if you
            want to select hours with pincerlike precision.
          </li>
          <li>
            📅 You probably wanna use <a href="https://cal.com">cal.com</a> if
            you need something like this but better, and built by an actual
            business.
          </li>
        </ul>
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
            </CheckboxField>
          </form>
        </section>
      </div>
    </footer>
  );
}
