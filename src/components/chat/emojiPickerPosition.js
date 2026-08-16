import { EMOJI_PICKER_PAD, EMOJI_PICKER_WIDTH } from "./chatConstants";

export const getEmojiPickerPosition = (button) => {
  if (!button) return null;

  const rect = button.getBoundingClientRect();
  const shellEl = button.closest(".container");
  const shell = shellEl?.getBoundingClientRect() ?? {
    left: EMOJI_PICKER_PAD,
    right: window.innerWidth - EMOJI_PICKER_PAD,
    top: EMOJI_PICKER_PAD,
    bottom: window.innerHeight - EMOJI_PICKER_PAD,
  };

  const minLeft = shell.left + EMOJI_PICKER_PAD;
  const maxLeft = shell.right - EMOJI_PICKER_WIDTH - EMOJI_PICKER_PAD;

  // Prefer above the button. If that would spill past the app container
  // right edge, open fully to the left of the button edge.
  let left = rect.left;
  if (left + EMOJI_PICKER_WIDTH > shell.right - EMOJI_PICKER_PAD) {
    left = rect.right - EMOJI_PICKER_WIDTH;
  }

  left = Math.min(Math.max(minLeft, left), Math.max(minLeft, maxLeft));

  return {
    left,
    bottom: Math.max(
      EMOJI_PICKER_PAD,
      window.innerHeight - rect.top + EMOJI_PICKER_PAD
    ),
  };
};
