import { useEffect, useRef } from "react";
import { setTypingStatus } from "../../../lib/chatService";
import { TYPING_TTL_MS } from "../chatConstants";

/** Own typing flag + debounce clear for the open chat. */
export function useOwnTyping({ chatId, currentUserId, isChatBlocked }) {
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chatId]);

  useEffect(() => {
    return () => {
      if (!chatId || !currentUserId || !isTypingRef.current) return;
      setTypingStatus(chatId, currentUserId, false).catch(() => {});
    };
  }, [chatId, currentUserId]);

  const clearOwnTyping = async () => {
    if (!chatId || !currentUserId || !isTypingRef.current) return;
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    try {
      await setTypingStatus(chatId, currentUserId, false);
    } catch (error) {
      console.warn("[Chat] Failed to clear typing:", error.code, error.message);
    }
  };

  const onComposerTextChange = (value, setText) => {
    setText(value);
    if (!chatId || !currentUserId || isChatBlocked) return;

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTypingStatus(chatId, currentUserId, true).catch((error) => {
          console.warn(
            "[Chat] Failed to set typing:",
            error.code,
            error.message
          );
        });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        clearOwnTyping();
      }, TYPING_TTL_MS);
    } else {
      clearOwnTyping();
    }
  };

  return { clearOwnTyping, onComposerTextChange };
}
