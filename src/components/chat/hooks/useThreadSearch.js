import { useEffect, useMemo, useState } from "react";

/** In-thread text search + match navigation. */
export function useThreadSearch(messages, chatId) {
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const searchQuery = threadSearch.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!searchQuery) return [];
    return messages
      .filter(
        (message) =>
          !message.deleted &&
          message.id &&
          (message.text ?? "").toLowerCase().includes(searchQuery)
      )
      .map((message) => message.id);
  }, [messages, searchQuery]);

  useEffect(() => {
    setThreadSearchOpen(false);
    setThreadSearch("");
    setActiveMatchIndex(0);
  }, [chatId]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery, chatId]);

  const toggleSearch = () => {
    setThreadSearchOpen((open) => {
      if (open) {
        setThreadSearch("");
        setActiveMatchIndex(0);
      }
      return !open;
    });
  };

  const goPrevMatch = () => {
    setActiveMatchIndex((i) =>
      matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0
    );
  };

  const goNextMatch = () => {
    setActiveMatchIndex((i) =>
      matchIds.length ? (i + 1) % matchIds.length : 0
    );
  };

  return {
    threadSearchOpen,
    threadSearch,
    setThreadSearch,
    activeMatchIndex,
    setActiveMatchIndex,
    searchQuery,
    matchIds,
    toggleSearch,
    goPrevMatch,
    goNextMatch,
  };
}
