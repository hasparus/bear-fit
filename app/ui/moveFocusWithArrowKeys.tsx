import type React from "react";

export function moveFocusWithArrowKeys(
  e: React.KeyboardEvent<HTMLButtonElement>,
  onClick: () => void,
) {
  const grid = e.currentTarget.parentElement!.parentElement!;

  const allButtons = grid.querySelectorAll("button");
  let index = Array.from(allButtons).indexOf(
    e.currentTarget as HTMLButtonElement,
  );

  // move focus to next button with arrow keys
  switch (e.key) {
    case " ":
    case "Enter":
      onClick();
      break;
    case "ArrowDown":
      index += 7;
      break;
    case "ArrowLeft":
      index--;
      break;

    case "ArrowRight":
      index++;
      break;
    case "ArrowUp":
      index -= 7;
      break;
  }

  const nextFocused = allButtons[index % allButtons.length];
  if (nextFocused) {
    nextFocused.focus();
  }
}
