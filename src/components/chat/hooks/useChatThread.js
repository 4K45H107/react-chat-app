import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  listenLatestMessages,
  loadOlderMessages,
  markChatAsSeen,
  migrateLegacyMessages,
} from "../../../lib/chatService";
import { rateLimitToastMessage } from "../../../lib/rateLimit";

/**
 * Live newest page + older pagination, scroll stickiness, and seen/migration.
 */
export function useChatThread({ chatId, currentUserId }) {
  const [latestMessages, setLatestMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const endRef = useRef(null);
  const centerRef = useRef(null);
  const messageNodeRefs = useRef(new Map());
  const migratedRef = useRef(new Set());
  const oldestDocRef = useRef(null);
  const hasLoadedOlderRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const isLoadingOlderRef = useRef(false);

  const messages = useMemo(() => {
    const olderIds = new Set(olderMessages.map((message) => message.id));
    return [
      ...olderMessages,
      ...latestMessages.filter((message) => !olderIds.has(message.id)),
    ];
  }, [olderMessages, latestMessages]);

  useEffect(() => {
    setLatestMessages([]);
    setOlderMessages([]);
    setHasMore(false);
    oldestDocRef.current = null;
    hasLoadedOlderRef.current = false;
    shouldStickToBottomRef.current = true;
    messageNodeRefs.current.clear();
  }, [chatId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current || isLoadingOlder) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingOlder]);

  useEffect(() => {
    if (!chatId || migratedRef.current.has(chatId)) return;

    migrateLegacyMessages(chatId)
      .catch((error) => {
        console.warn(
          "[Chat] Legacy message migration skipped:",
          error.code,
          error.message
        );
      })
      .finally(() => {
        migratedRef.current.add(chatId);
      });
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return undefined;

    const unsub = listenLatestMessages(chatId, {
      onData: ({ messages: newestPage, oldestDoc, hasMore: pageHasMore }) => {
        setLatestMessages(newestPage);

        if (!hasLoadedOlderRef.current) {
          oldestDocRef.current = oldestDoc;
          setHasMore(pageHasMore);
        }
      },
      onError: (error) => {
        console.error(
          "[Chat] Failed to listen to chat messages:",
          error.code,
          error.message,
          error
        );
      },
    });

    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;

    markChatAsSeen(currentUserId, chatId).catch((error) => {
      console.warn(
        "[Chat] Failed to mark chat as seen:",
        error.code,
        error.message
      );
    });
  }, [chatId, currentUserId]);

  const handleLoadOlder = async () => {
    if (
      !chatId ||
      !hasMore ||
      !oldestDocRef.current ||
      isLoadingOlderRef.current
    ) {
      return;
    }

    isLoadingOlderRef.current = true;
    hasLoadedOlderRef.current = true;
    setIsLoadingOlder(true);
    shouldStickToBottomRef.current = false;

    const centerEl = centerRef.current;
    const previousHeight = centerEl?.scrollHeight ?? 0;
    const previousTop = centerEl?.scrollTop ?? 0;

    try {
      const result = await loadOlderMessages(chatId, oldestDocRef.current);

      if (result.messages.length) {
        setOlderMessages((prev) => [...result.messages, ...prev]);
        oldestDocRef.current = result.oldestDoc;
      }

      setHasMore(result.hasMore);

      requestAnimationFrame(() => {
        if (!centerEl) return;
        centerEl.scrollTop =
          centerEl.scrollHeight - previousHeight + previousTop;
      });
    } catch (error) {
      const limited = rateLimitToastMessage(error);
      if (limited) {
        toast.warn(limited);
        return;
      }
      console.error(
        "[Chat] Failed to load older messages:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to load older messages.");
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  };

  const handleCenterScroll = () => {
    const centerEl = centerRef.current;
    if (!centerEl) return;

    const distanceFromBottom =
      centerEl.scrollHeight - centerEl.scrollTop - centerEl.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;

    if (centerEl.scrollTop < 80) {
      handleLoadOlder();
    }
  };

  return {
    messages,
    isLoadingOlder,
    hasMore,
    endRef,
    centerRef,
    messageNodeRefs,
    shouldStickToBottomRef,
    handleCenterScroll,
  };
}
