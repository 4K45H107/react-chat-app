import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { formatAudioClock } from "../../lib/audioRecord";
import { getStoredTheme } from "../../lib/theme";
import { EMOJI_PICKER_WIDTH } from "./chatConstants";
import { getEmojiPickerPosition } from "./emojiPickerPosition";

export default function ChatComposer({
  isChatBlocked,
  isSending,
  canSend,
  isRecording,
  recordSeconds,
  text,
  onTextChange,
  onKeyDown,
  onSend,
  onImageSelect,
  onOpenCamera,
  onStartRecording,
  onCancelRecording,
  onSendRecording,
  composerInputRef,
  emojiDismissKey = 0,
}) {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [emojiPickerPos, setEmojiPickerPos] = useState(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (!emojiDismissKey) return;
    setOpenEmoji(false);
    setEmojiPickerPos(null);
  }, [emojiDismissKey]);

  useEffect(() => {
    if (!openEmoji) return;

    const placePicker = () => {
      const next = getEmojiPickerPosition(emojiButtonRef.current);
      if (next) setEmojiPickerPos(next);
    };

    placePicker();
    document.body.classList.add("emoji-picker-open");
    window.addEventListener("resize", placePicker);
    window.addEventListener("scroll", placePicker, true);

    const handleClickOutside = (event) => {
      if (emojiButtonRef.current?.contains(event.target)) return;
      if (emojiPickerRef.current?.contains(event.target)) return;
      setOpenEmoji(false);
      setEmojiPickerPos(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.body.classList.remove("emoji-picker-open");
      window.removeEventListener("resize", placePicker);
      window.removeEventListener("scroll", placePicker, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openEmoji]);

  const handleToggleEmojiPicker = () => {
    if (isChatBlocked || isSending) return;

    setOpenEmoji((wasOpen) => {
      if (wasOpen) {
        setEmojiPickerPos(null);
        return false;
      }

      const next = getEmojiPickerPosition(emojiButtonRef.current);
      setEmojiPickerPos(next);
      return Boolean(next);
    });
  };

  const handleEmoji = (e) => {
    onTextChange(text + e.emoji);
    setOpenEmoji(false);
    setEmojiPickerPos(null);
  };

  return (
    <div className={`bottom ${isChatBlocked ? "disabled" : ""}`}>
      {isRecording ? (
        <div className="voiceRecorder" role="status" aria-live="polite">
          <span className="recDot" aria-hidden="true" />
          <span className="recLabel">
            Recording {formatAudioClock(recordSeconds)}
          </span>
          <button
            type="button"
            className="recCancel"
            onClick={onCancelRecording}
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="recSend"
            onClick={onSendRecording}
            disabled={isSending || recordSeconds < 1}
          >
            Send
          </button>
        </div>
      ) : (
        <>
          <div className="icons">
            <label
              className={`attachImage${
                isChatBlocked || isSending ? " disabled" : ""
              }`}
              aria-label="Send an image"
            >
              <img src="./img.png" alt="" aria-hidden="true" />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                disabled={isChatBlocked || isSending}
                onChange={onImageSelect}
              />
            </label>
            <button
              type="button"
              className="cameraButton"
              onClick={onOpenCamera}
              disabled={isChatBlocked || isSending || !canSend}
              aria-label="Take a photo"
            >
              <img src="./camera.png" alt="" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="micButton"
              onClick={onStartRecording}
              disabled={isChatBlocked || isSending || !canSend}
              aria-label="Record voice message"
            >
              <img src="./mic.png" alt="" aria-hidden="true" />
            </button>
          </div>
          <input
            ref={composerInputRef}
            className="composerInput"
            type="text"
            value={text || ""}
            placeholder={
              isChatBlocked ? "Messaging unavailable" : "Type a message..."
            }
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isChatBlocked}
            aria-label="Message"
          />
          <div className="emoji">
            <button
              ref={emojiButtonRef}
              type="button"
              className="emojiToggle"
              aria-label="Open emoji picker"
              aria-expanded={openEmoji}
              disabled={isChatBlocked || isSending}
              onClick={handleToggleEmojiPicker}
            >
              <span className="emojiGlyph" aria-hidden="true">
                😊
              </span>
            </button>
            {openEmoji &&
              emojiPickerPos &&
              !isChatBlocked &&
              createPortal(
                <div
                  ref={emojiPickerRef}
                  className="emojiPickerPortal"
                  style={{
                    left: emojiPickerPos.left,
                    bottom: emojiPickerPos.bottom,
                  }}
                  role="dialog"
                  aria-label="Emoji picker"
                >
                  <EmojiPicker
                    theme={
                      getStoredTheme() === "light" ? Theme.LIGHT : Theme.DARK
                    }
                    onEmojiClick={handleEmoji}
                    autoFocusSearch={false}
                    width={EMOJI_PICKER_WIDTH}
                    height={420}
                  />
                </div>,
                document.body
              )}
          </div>
          <button
            className="sendButton"
            onClick={onSend}
            disabled={isChatBlocked || isSending}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </>
      )}
    </div>
  );
}
