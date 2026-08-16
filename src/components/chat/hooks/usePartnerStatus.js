import { useEffect, useState } from "react";
import { listenChatTyping } from "../../../lib/chatService";
import { isUserOnline, listenUserPresence } from "../../../lib/presence";
import { TYPING_TTL_MS } from "../chatConstants";

/** Partner typing indicator + online presence for the open chat. */
export function usePartnerStatus({
  chatId,
  userId,
  currentUserId,
  isGroup,
}) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);

  useEffect(() => {
    setPartnerTyping(false);
    setPartnerOnline(false);
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !currentUserId) return undefined;
    if (!isGroup && !userId) return undefined;

    let clearPartnerTimer = null;

    const unsub = listenChatTyping(chatId, {
      onData: (typing) => {
        if (clearPartnerTimer) clearTimeout(clearPartnerTimer);

        if (!typing?.userId || typing.userId === currentUserId) {
          setPartnerTyping(false);
          return;
        }

        const age = Date.now() - (typing.updatedAt ?? 0);
        const isPartner = isGroup || typing.userId === userId;
        const fresh = age < TYPING_TTL_MS && isPartner;
        setPartnerTyping(fresh);

        if (fresh) {
          clearPartnerTimer = setTimeout(() => {
            setPartnerTyping(false);
          }, TYPING_TTL_MS - age);
        }
      },
      onError: (error) => {
        console.warn(
          "[Chat] Typing listener failed:",
          error.code,
          error.message
        );
      },
    });

    return () => {
      unsub();
      if (clearPartnerTimer) clearTimeout(clearPartnerTimer);
    };
  }, [chatId, userId, currentUserId, isGroup]);

  useEffect(() => {
    if (isGroup || !userId) {
      setPartnerOnline(false);
      return undefined;
    }

    let refreshTimer = null;
    const unsub = listenUserPresence(userId, {
      onData: (lastActive) => {
        setPartnerOnline(isUserOnline(lastActive));
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          setPartnerOnline(isUserOnline(lastActive));
        }, 60_000);
      },
      onError: (error) => {
        console.warn(
          "[Chat] Presence listener failed:",
          error.code,
          error.message
        );
      },
    });

    return () => {
      unsub();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [userId, isGroup]);

  return { partnerTyping, partnerOnline };
}
