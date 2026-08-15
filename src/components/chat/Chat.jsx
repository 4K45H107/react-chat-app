import React, { useState, useRef, useEffect } from "react";
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

const TYPING_TTL_MS = 4000;

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");
  const [latestMessages, setLatestMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
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
  const emojiRef = useRef(null);
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

  // Reset pagination / typing state when switching conversations
  useEffect(() => {
    setLatestMessages([]);
    setOlderMessages([]);
    setHasMore(false);
    setPartnerTyping(false);
    setPartnerOnline(false);
    oldestDocRef.current = null;
    hasLoadedOlderRef.current = false;
    shouldStickToBottomRef.current = true;
    isTypingRef.current = false;
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

    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setOpenEmoji(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

          return (
          <div
            className={`message ${
              message.senderId === currentUser.id ? "own" : ""
            }${message.deleted ? " deleted" : ""}`}
            key={message.id ?? `${message.senderId}-${index}`}
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
        <div className="emoji" ref={emojiRef}>
          <button
            type="button"
            className="emojiToggle"
            aria-label="Open emoji picker"
            aria-expanded={openEmoji}
            disabled={isChatBlocked || isSending}
            onClick={() =>
              !isChatBlocked && !isSending && setOpenEmoji((prev) => !prev)
            }
          >
            <img src="./emoji.png" alt="" aria-hidden="true" />
          </button>
          {openEmoji && !isChatBlocked && (
            <div className="picker" role="dialog" aria-label="Emoji picker">
              <EmojiPicker theme={Theme.DARK} onEmojiClick={handleEmoji} />
            </div>
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
