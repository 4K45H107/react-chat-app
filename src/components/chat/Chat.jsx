import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import "./chat.css";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "react-toastify";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { formatMessageTime } from "../../lib/formatTime";
import upload from "../../lib/upload";
import {
  deleteMessage,
  editMessage,
  listenChatTyping,
  listenLatestMessages,
  loadOlderMessages,
  markChatAsSeen,
  migrateLegacyMessages,
  sendMessage,
  setTypingStatus,
  syncSidebarPreview,
} from "../../lib/chatService";
import { isUserOnline, listenUserPresence } from "../../lib/presence";
import { getStoredTheme } from "../../lib/theme";

const TYPING_TTL_MS = 4000;

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [emojiPickerPos, setEmojiPickerPos] = useState({ bottom: 80, left: 16 });
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const [text, setText] = useState("");
  const [latestMessages, setLatestMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);

  const {
    chatId,
    user,
    isCurrentUserBlocked,
    isReceiverBlocked,
    closeChat,
    toggleDetails,
  } = useChatStore();
  const { currentUser } = useUserStore();

  const isChatBlocked = isCurrentUserBlocked || isReceiverBlocked;

  const endRef = useRef(null);
  const centerRef = useRef(null);
  const messageNodeRefs = useRef(new Map());
  const imageInputRef = useRef(null);
  const migratedRef = useRef(new Set());
  const oldestDocRef = useRef(null);
  const hasLoadedOlderRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const olderIds = new Set(olderMessages.map((message) => message.id));
  const messages = [
    ...olderMessages,
    ...latestMessages.filter((message) => !olderIds.has(message.id)),
  ];

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
    setActiveMatchIndex(0);
  }, [searchQuery, chatId]);

  useEffect(() => {
    if (!matchIds.length) return;
    const safeIndex = Math.min(activeMatchIndex, matchIds.length - 1);
    if (safeIndex !== activeMatchIndex) {
      setActiveMatchIndex(safeIndex);
      return;
    }
    const node = messageNodeRefs.current.get(matchIds[safeIndex]);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, matchIds]);

  // Reset pagination / typing / search / edit state when switching conversations
  useEffect(() => {
    setLatestMessages([]);
    setOlderMessages([]);
    setHasMore(false);
    setPartnerTyping(false);
    setPartnerOnline(false);
    setEditingMessageId(null);
    setEditText("");
    setThreadSearchOpen(false);
    setThreadSearch("");
    setActiveMatchIndex(0);
    oldestDocRef.current = null;
    hasLoadedOlderRef.current = false;
    shouldStickToBottomRef.current = true;
    isTypingRef.current = false;
    messageNodeRefs.current.clear();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !user?.id) return;

    let clearPartnerTimer = null;

    const unsub = listenChatTyping(chatId, {
      onData: (typing) => {
        if (clearPartnerTimer) clearTimeout(clearPartnerTimer);

        if (!typing?.userId || typing.userId === currentUser.id) {
          setPartnerTyping(false);
          return;
        }

        const age = Date.now() - (typing.updatedAt ?? 0);
        const fresh = age < TYPING_TTL_MS && typing.userId === user.id;
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
  }, [chatId, user?.id, currentUser.id]);

  // Clear own typing flag on unmount / leave chat
  useEffect(() => {
    return () => {
      if (!chatId || !currentUser?.id || !isTypingRef.current) return;
      setTypingStatus(chatId, currentUser.id, false).catch(() => {});
    };
  }, [chatId, currentUser?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let refreshTimer = null;
    const unsub = listenUserPresence(user.id, {
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
  }, [user?.id]);

  const clearOwnTyping = async () => {
    if (!chatId || !currentUser?.id || !isTypingRef.current) return;
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    try {
      await setTypingStatus(chatId, currentUser.id, false);
    } catch (error) {
      console.warn("[Chat] Failed to clear typing:", error.code, error.message);
    }
  };

  const handleTextChange = (value) => {
    setText(value);
    if (!chatId || !currentUser?.id || isChatBlocked) return;

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTypingStatus(chatId, currentUser.id, true).catch((error) => {
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

  useEffect(() => {
    if (!chatId || !currentUser?.id) return;

    markChatAsSeen(currentUser.id, chatId).catch((error) => {
      console.warn(
        "[Chat] Failed to mark chat as seen:",
        error.code,
        error.message
      );
    });
  }, [chatId, currentUser?.id]);

  useEffect(() => {
    if (!openEmoji) return;

    const placePicker = () => {
      const button = emojiButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const pickerWidth = 350;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - pickerWidth - 8
      );
      setEmojiPickerPos({
        left,
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
      });
    };

    placePicker();
    window.addEventListener("resize", placePicker);
    window.addEventListener("scroll", placePicker, true);

    const handleClickOutside = (event) => {
      if (emojiButtonRef.current?.contains(event.target)) return;
      if (emojiPickerRef.current?.contains(event.target)) return;
      setOpenEmoji(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("resize", placePicker);
      window.removeEventListener("scroll", placePicker, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openEmoji]);

  const handleEmoji = (e) => {
    let newText = text + e.emoji;
    setText(newText);
    setOpenEmoji(false);
  };

  const handleSend = async () => {
    if (text === "" || !user || isChatBlocked || isSending) return;

    setIsSending(true);
    shouldStickToBottomRef.current = true;
    try {
      await clearOwnTyping();
      await sendMessage({
        chatId,
        senderId: currentUser.id,
        text,
      });
      await syncSidebarPreview({
        chatId,
        currentUserId: currentUser.id,
        otherUserId: user.id,
        preview: text,
      });
      setText("");
    } catch (error) {
      console.error(
        "[Chat] Failed to send message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || isChatBlocked || isSending) return;

    if (!file.type.startsWith("image/")) {
      toast.warn("Please choose an image file.");
      return;
    }

    setIsSending(true);
    shouldStickToBottomRef.current = true;
    try {
      await clearOwnTyping();
      const imgUrl = await upload(file, { uid: currentUser.id });
      if (!imgUrl) {
        toast.error("Failed to upload image. Please try again.");
        return;
      }

      const caption = text.trim();
      await sendMessage({
        chatId,
        senderId: currentUser.id,
        text: caption,
        img: imgUrl,
      });
      await syncSidebarPreview({
        chatId,
        currentUserId: currentUser.id,
        otherUserId: user.id,
        preview: caption || "Photo",
      });
      setText("");
    } catch (error) {
      console.error(
        "[Chat] Failed to send image:",
        error.code || error,
        error.message || error
      );
      toast.error("Failed to send image. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleSend();
  };

  const handleDeleteMessage = async (message) => {
    if (!message?.id || message.senderId !== currentUser.id || message.deleted) {
      return;
    }

    try {
      if (editingMessageId === message.id) {
        setEditingMessageId(null);
        setEditText("");
      }
      await deleteMessage(chatId, message);
    } catch (error) {
      console.error(
        "[Chat] Failed to delete message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to delete message. Please try again.");
    }
  };

  const handleStartEdit = (message) => {
    if (!message?.id || message.senderId !== currentUser.id || message.deleted) {
      return;
    }
    setEditingMessageId(message.id);
    setEditText(message.text ?? "");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const handleSaveEdit = async (message) => {
    const nextText = editText.trim();
    if (!message?.id || !nextText) {
      toast.warn("Message cannot be empty.");
      return;
    }

    if (nextText === (message.text ?? "")) {
      handleCancelEdit();
      return;
    }

    try {
      await editMessage(chatId, message, nextText);
      handleCancelEdit();
    } catch (error) {
      console.error(
        "[Chat] Failed to edit message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to edit message. Please try again.");
    }
  };

  return (
    <div className="chat">
      {/* ------ TOP ------ */}
      <div className="top">
        <button
          type="button"
          className="backButton"
          onClick={closeChat}
          aria-label="Back to chat list"
        >
          ←
        </button>
        <div className="user">
          <img
            src={user?.avatar || "./avatar.png"}
            alt={user?.username ?? "Chat partner"}
          />
          <div className="texts">
            <span>{user?.username ?? "Unknown user"}</span>
            <p className={partnerTyping ? "typingStatus" : undefined}>
              {partnerTyping
                ? "typing…"
                : partnerOnline
                  ? "Online"
                  : (user?.email ?? "Offline")}
            </p>
          </div>
        </div>
        <div className="icons">
          <button
            type="button"
            className="iconButton"
            onClick={() =>
              setThreadSearchOpen((open) => {
                if (open) {
                  setThreadSearch("");
                  setActiveMatchIndex(0);
                }
                return !open;
              })
            }
            aria-label={threadSearchOpen ? "Close message search" : "Search in chat"}
            aria-pressed={threadSearchOpen}
          >
            <svg
              className="chromeIcon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="16"
                y1="16"
                x2="20.5"
                y2="20.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <img src="./phone.png" alt="" aria-hidden="true" />
          <img src="./video.png" alt="" aria-hidden="true" />
          <button
            type="button"
            className="iconButton"
            onClick={toggleDetails}
            aria-label="Toggle chat details"
          >
            <img src="./info.png" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      {threadSearchOpen && (
        <div className="threadSearch" role="search">
          <input
            type="text"
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search in this chat…"
            aria-label="Search messages in this chat"
            autoFocus
          />
          <span className="matchCount" aria-live="polite">
            {searchQuery
              ? matchIds.length
                ? `${activeMatchIndex + 1}/${matchIds.length}`
                : "0 matches"
              : "—"}
          </span>
          <button
            type="button"
            className="searchNav"
            disabled={!matchIds.length}
            onClick={() =>
              setActiveMatchIndex((i) =>
                matchIds.length ? (i - 1 + matchIds.length) % matchIds.length : 0
              )
            }
            aria-label="Previous match"
          >
            ↑
          </button>
          <button
            type="button"
            className="searchNav"
            disabled={!matchIds.length}
            onClick={() =>
              setActiveMatchIndex((i) =>
                matchIds.length ? (i + 1) % matchIds.length : 0
              )
            }
            aria-label="Next match"
          >
            ↓
          </button>
        </div>
      )}

      {/* ------ CENTER ------ */}
      <div
        className="center"
        ref={centerRef}
        onScroll={handleCenterScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Message thread"
      >
        {isLoadingOlder && (
          <p className="loadOlderHint">Loading earlier messages…</p>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="loadOlderHint">Beginning of conversation</p>
        )}
        {isChatBlocked && (
          <p className="blockedNotice">
            {isCurrentUserBlocked
              ? "You can't message this user — you've been blocked."
              : "You blocked this user."}
          </p>
        )}
        {!messages.length && !isChatBlocked && (
          <p className="emptyMessages">
            No messages yet. Say hello to start the conversation.
          </p>
        )}
        {messages.map((message, index) => {
          const isEditing = editingMessageId === message.id;
          const isMatch =
            Boolean(message.id) && matchIds.includes(message.id);
          const isActiveMatch =
            isMatch && matchIds[activeMatchIndex] === message.id;

          return (
          <div
            className={`message ${
              message.senderId === currentUser.id ? "own" : ""
            }${message.deleted ? " deleted" : ""}${
              isMatch ? " searchMatch" : ""
            }${isActiveMatch ? " searchMatchActive" : ""}`}
            key={message.id ?? `${message.senderId}-${index}`}
            ref={(node) => {
              if (!message.id) return;
              if (node) messageNodeRefs.current.set(message.id, node);
              else messageNodeRefs.current.delete(message.id);
            }}
          >
            <div className="texts">
              {message.deleted ? (
                <p className="deletedText">Message deleted</p>
              ) : isEditing ? (
                <div className="editComposer">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveEdit(message);
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    maxLength={2000}
                    aria-label="Edit message"
                    autoFocus
                  />
                  <div className="editActions">
                    <button type="button" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleSaveEdit(message)}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {message.img ? (
                    <a
                      className="messageImageLink"
                      href={message.img}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        className="messageImage"
                        src={message.img}
                        alt={message.text || "Shared image"}
                      />
                    </a>
                  ) : null}
                  {message.text ? <p>{message.text}</p> : null}
                </>
              )}
              <div className="messageMeta">
                <span>
                  {formatMessageTime(message.createdAt)}
                  {message.edited && !message.deleted ? " · edited" : ""}
                </span>
                {message.senderId === currentUser.id &&
                  !message.deleted &&
                  !isEditing && (
                    <>
                      <button
                        type="button"
                        className="editMessage"
                        onClick={() => handleStartEdit(message)}
                        aria-label="Edit message"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="deleteMessage"
                        onClick={() => handleDeleteMessage(message)}
                        aria-label="Delete message"
                      >
                        Delete
                      </button>
                    </>
                  )}
              </div>
            </div>
          </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className={`bottom ${isChatBlocked ? "disabled" : ""}`}>
        <div className="icons">
          <label
            className={`attachImage${isChatBlocked || isSending ? " disabled" : ""}`}
            aria-label="Send an image"
          >
            <img src="./img.png" alt="" aria-hidden="true" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              disabled={isChatBlocked || isSending}
              onChange={handleImageSelect}
            />
          </label>
          <img src="./camera.png" alt="" aria-hidden="true" />
          <img src="./mic.png" alt="" aria-hidden="true" />
        </div>
        <input
          className="composerInput"
          type="text"
          value={text || ""}
          placeholder={
            isChatBlocked
              ? "Messaging unavailable"
              : isSending
                ? "Sending..."
                : "Type a message..."
          }
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={isChatBlocked || isSending}
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
            onClick={() =>
              !isChatBlocked && !isSending && setOpenEmoji((prev) => !prev)
            }
          >
            <span className="emojiGlyph" aria-hidden="true">
              😊
            </span>
          </button>
          {openEmoji &&
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
                />
              </div>,
              document.body
            )}
        </div>
        <button
          className="sendButton"
          onClick={handleSend}
          disabled={isChatBlocked || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default Chat;
