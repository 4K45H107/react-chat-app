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
  extensionForAudioMime,
  formatAudioClock,
  pickAudioMimeType,
} from "../../lib/audioRecord";
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
const EMOJI_PICKER_WIDTH = 352;
const EMOJI_PICKER_PAD = 8;
const MAX_VOICE_SECONDS = 120;

const getEmojiPickerPosition = (button) => {
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
    bottom: Math.max(EMOJI_PICKER_PAD, window.innerHeight - rect.top + EMOJI_PICKER_PAD),
  };
};

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [emojiPickerPos, setEmojiPickerPos] = useState(null);
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const {
    chatId,
    user,
    isGroup,
    groupName,
    groupAvatar,
    participantIds,
    members,
    isCurrentUserBlocked,
    isReceiverBlocked,
    closeChat,
    toggleDetails,
  } = useChatStore();
  const { currentUser } = useUserStore();

  const isChatBlocked =
    !isGroup && (isCurrentUserBlocked || isReceiverBlocked);

  const memberNameById = useMemo(() => {
    const map = new Map();
    for (const member of members ?? []) {
      if (member?.id) map.set(member.id, member.username || "Member");
    }
    if (currentUser?.id) {
      map.set(currentUser.id, currentUser.username || "You");
    }
    return map;
  }, [members, currentUser?.id, currentUser?.username]);

  const canSend = Boolean(chatId) && (isGroup || Boolean(user));

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
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartedAtRef = useRef(0);
  const recordMimeRef = useRef("");
  const shouldSendRecordingRef = useRef(false);

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
    setIsRecording(false);
    setRecordSeconds(0);
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
    if (!chatId || !currentUser?.id) return;
    if (!isGroup && !user?.id) return;

    let clearPartnerTimer = null;

    const unsub = listenChatTyping(chatId, {
      onData: (typing) => {
        if (clearPartnerTimer) clearTimeout(clearPartnerTimer);

        if (!typing?.userId || typing.userId === currentUser.id) {
          setPartnerTyping(false);
          return;
        }

        const age = Date.now() - (typing.updatedAt ?? 0);
        const isPartner =
          isGroup || typing.userId === user?.id;
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
  }, [chatId, user?.id, currentUser.id, isGroup]);

  // Clear own typing flag on unmount / leave chat
  useEffect(() => {
    return () => {
      if (!chatId || !currentUser?.id || !isTypingRef.current) return;
      setTypingStatus(chatId, currentUser.id, false).catch(() => {});
    };
  }, [chatId, currentUser?.id]);

  useEffect(() => {
    if (isGroup || !user?.id) {
      setPartnerOnline(false);
      return;
    }

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
  }, [user?.id, isGroup]);

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

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const clearRecordTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    shouldSendRecordingRef.current = false;
    clearRecordTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopMediaTracks();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  useEffect(() => {
    return () => {
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup only
  }, []);

  useEffect(() => {
    if (!chatId) return;
    cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on chat switch
  }, [chatId]);

  const handleStartRecording = async () => {
    if (
      isChatBlocked ||
      isSending ||
      isRecording ||
      !canSend ||
      typeof MediaRecorder === "undefined"
    ) {
      if (typeof MediaRecorder === "undefined") {
        toast.warn("Voice messages are not supported in this browser.");
      }
      return;
    }

    const mimeType = pickAudioMimeType();
    if (!mimeType) {
      toast.warn("Voice recording is not supported in this browser.");
      return;
    }

    try {
      await clearOwnTyping();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordMimeRef.current = mimeType;
      shouldSendRecordingRef.current = false;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        clearRecordTimer();
        stopMediaTracks();
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);

        const shouldSend = shouldSendRecordingRef.current;
        shouldSendRecordingRef.current = false;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordStartedAtRef.current) / 1000)
        );
        setRecordSeconds(0);

        if (!shouldSend || !chunks.length) return;

        const blob = new Blob(chunks, { type: recordMimeRef.current || "audio/webm" });
        if (blob.size < 200) {
          toast.warn("Recording was too short. Try again.");
          return;
        }

        setIsSending(true);
        shouldStickToBottomRef.current = true;
        try {
          const ext = extensionForAudioMime(blob.type);
          const file = new File([blob], `voice.${ext}`, {
            type: blob.type || "audio/webm",
          });
          const audioUrl = await upload(file, {
            uid: currentUser.id,
            folder: "audio",
            fileName: `voice.${ext}`,
          });
          if (!audioUrl) {
            toast.error("Failed to upload voice message. Please try again.");
            return;
          }

          await sendMessage({
            chatId,
            senderId: currentUser.id,
            text: "",
            audio: audioUrl,
            audioDuration: Math.min(durationSec, MAX_VOICE_SECONDS),
          });
          await syncSidebarPreview({
            chatId,
            currentUserId: currentUser.id,
            preview: "Voice message",
          });
        } catch (error) {
          console.error(
            "[Chat] Failed to send voice message:",
            error.code || error,
            error.message || error
          );
          toast.error("Failed to send voice message. Please try again.");
        } finally {
          setIsSending(false);
        }
      };

      recorder.start(250);
      recordStartedAtRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      clearRecordTimer();
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordStartedAtRef.current) / 1000
        );
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SECONDS) {
          shouldSendRecordingRef.current = true;
          if (mediaRecorderRef.current?.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        }
      }, 250);
    } catch (error) {
      console.error(
        "[Chat] Microphone permission / start failed:",
        error.name,
        error.message
      );
      stopMediaTracks();
      setIsRecording(false);
      if (error?.name === "NotAllowedError") {
        toast.error("Microphone permission is required for voice messages.");
      } else {
        toast.error("Could not start recording. Please try again.");
      }
    }
  };

  const handleSendRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    shouldSendRecordingRef.current = true;
    clearRecordTimer();
    try {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.warn("[Chat] Failed to stop recorder:", error);
      cancelRecording();
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
    let newText = text + e.emoji;
    setText(newText);
    setOpenEmoji(false);
    setEmojiPickerPos(null);
  };

  const handleSend = async () => {
    if (text === "" || !canSend || isChatBlocked || isSending) return;

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
    if (!file || !canSend || isChatBlocked || isSending) return;

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
          {isGroup ? (
            groupAvatar ? (
              <img
                src={groupAvatar}
                alt={groupName || "Group"}
              />
            ) : (
              <div className="groupAvatarHeader" aria-hidden="true">
                {(groupName || "G").slice(0, 1).toUpperCase()}
              </div>
            )
          ) : (
            <img
              src={user?.avatar || "./avatar.png"}
              alt={user?.username ?? "Chat partner"}
            />
          )}
          <div className="texts">
            <span>
              {isGroup ? groupName || "Group" : user?.username ?? "Unknown user"}
            </span>
            <p className={partnerTyping ? "typingStatus" : undefined}>
              {partnerTyping
                ? isGroup
                  ? "Someone is typing…"
                  : "typing…"
                : isGroup
                  ? `${participantIds?.length || members?.length || 0} members`
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
              {isGroup &&
                !message.deleted &&
                message.senderId !== currentUser.id && (
                  <span className="senderName">
                    {memberNameById.get(message.senderId) || "Member"}
                  </span>
                )}
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
                  {message.audio ? (
                    <div className="voiceMessage">
                      <audio
                        controls
                        preload="metadata"
                        src={message.audio}
                        aria-label="Voice message"
                      />
                      {typeof message.audioDuration === "number" ? (
                        <span className="voiceDuration">
                          {formatAudioClock(message.audioDuration)}
                        </span>
                      ) : null}
                    </div>
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
                      {message.text ? (
                        <button
                          type="button"
                          className="editMessage"
                          onClick={() => handleStartEdit(message)}
                          aria-label="Edit message"
                        >
                          Edit
                        </button>
                      ) : null}
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
        {isRecording ? (
          <div className="voiceRecorder" role="status" aria-live="polite">
            <span className="recDot" aria-hidden="true" />
            <span className="recLabel">
              Recording {formatAudioClock(recordSeconds)}
            </span>
            <button
              type="button"
              className="recCancel"
              onClick={cancelRecording}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="recSend"
              onClick={handleSendRecording}
              disabled={isSending || recordSeconds < 1}
            >
              Send
            </button>
          </div>
        ) : (
          <>
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
              <button
                type="button"
                className="micButton"
                onClick={handleStartRecording}
                disabled={isChatBlocked || isSending || !canSend}
                aria-label="Record voice message"
              >
                <img src="./mic.png" alt="" aria-hidden="true" />
              </button>
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
              onClick={handleSend}
              disabled={isChatBlocked || isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
