import React, { useState, useRef, useEffect } from "react";
import "./chat.css";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "react-toastify";
import { db } from "../../lib/firebase";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { formatMessageTime } from "../../lib/formatTime";
import upload from "../../lib/upload";

const PAGE_SIZE = 30;

const mapMessageDocs = (docs) =>
  docs.map((messageDoc) => ({
    id: messageDoc.id,
    ...messageDoc.data(),
  }));

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");
  const [latestMessages, setLatestMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);

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

  const olderIds = new Set(olderMessages.map((message) => message.id));
  const messages = [
    ...olderMessages,
    ...latestMessages.filter((message) => !olderIds.has(message.id)),
  ];

  // Reset pagination state when switching conversations
  useEffect(() => {
    setLatestMessages([]);
    setOlderMessages([]);
    setHasMore(false);
    oldestDocRef.current = null;
    hasLoadedOlderRef.current = false;
    shouldStickToBottomRef.current = true;
  }, [chatId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current || isLoadingOlder) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingOlder]);

  // One-time migrate legacy messages[] on the chat doc into the subcollection
  useEffect(() => {
    if (!chatId || migratedRef.current.has(chatId)) return;

    const migrateLegacyMessages = async () => {
      try {
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) return;

        const legacy = chatSnap.data()?.messages;
        if (!Array.isArray(legacy) || legacy.length === 0) {
          migratedRef.current.add(chatId);
          return;
        }

        for (const msg of legacy) {
          const messageId = msg.id || crypto.randomUUID();
          await setDoc(
            doc(db, "chats", chatId, "messages", messageId),
            {
              id: messageId,
              senderId: msg.senderId,
              text: msg.text ?? "",
              ...(msg.img ? { img: msg.img } : {}),
              createdAt: msg.createdAt ?? new Date(),
            },
            { merge: true }
          );
        }

        await updateDoc(chatRef, { messages: deleteField() });
        migratedRef.current.add(chatId);
      } catch (error) {
        console.warn(
          "[Chat] Legacy message migration skipped:",
          error.code,
          error.message
        );
      }
    };

    migrateLegacyMessages();
  }, [chatId]);

  // Live listener for the newest page of messages
  useEffect(() => {
    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(
      messagesQuery,
      (snap) => {
        setLatestMessages(mapMessageDocs(snap.docs).reverse());

        // Don't reset the older-page cursor after the user has scrolled up
        if (!hasLoadedOlderRef.current) {
          oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
          setHasMore(snap.docs.length === PAGE_SIZE);
        }
      },
      (error) => {
        console.error(
          "[Chat] Failed to listen to chat messages:",
          error.code,
          error.message,
          error
        );
      }
    );

    return () => unsub();
  }, [chatId]);

  const loadOlderMessages = async () => {
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
      const olderQuery = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "desc"),
        startAfter(oldestDocRef.current),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(olderQuery);
      const batch = mapMessageDocs(snap.docs).reverse();

      if (batch.length) {
        setOlderMessages((prev) => [...batch, ...prev]);
        oldestDocRef.current = snap.docs[snap.docs.length - 1];
      }

      setHasMore(snap.docs.length === PAGE_SIZE);

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
      loadOlderMessages();
    }
  };

  // Mark this conversation as seen in the current user's sidebar
  useEffect(() => {
    if (!chatId || !currentUser?.id) return;

    const markAsSeen = async () => {
      try {
        const userChatsRef = doc(db, "userChats", currentUser.id);
        const snap = await getDoc(userChatsRef);
        if (!snap.exists()) return;

        const chats = [...(snap.data().chats ?? [])];
        const chatIndex = chats.findIndex((c) => c.chatId === chatId);
        if (chatIndex === -1 || chats[chatIndex].isSeen) return;

        chats[chatIndex] = { ...chats[chatIndex], isSeen: true };
        await updateDoc(userChatsRef, { chats });
      } catch (error) {
        console.warn(
          "[Chat] Failed to mark chat as seen:",
          error.code,
          error.message
        );
      }
    };

    markAsSeen();
  }, [chatId, currentUser?.id]);

  // Close emoji picker when clicking outside the picker/toggle
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

  const syncSidebarPreview = async (preview) => {
    const participantIds = [currentUser.id, user.id];

    for (const participantId of participantIds) {
      try {
        const userChatsRef = doc(db, "userChats", participantId);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (!userChatsSnapshot.exists()) continue;

        const userChatsData = userChatsSnapshot.data();
        const chats = userChatsData.chats ?? [];
        const chatIndex = chats.findIndex((c) => c.chatId === chatId);

        if (chatIndex === -1) continue;

        chats[chatIndex].lastMessage = preview;
        chats[chatIndex].isSeen = participantId === currentUser.id;
        chats[chatIndex].updatedAt = Date.now();

        await updateDoc(userChatsRef, { chats });
      } catch (sidebarError) {
        console.warn(
          "[Chat] Failed to sync sidebar for participant:",
          participantId,
          sidebarError.code,
          sidebarError.message
        );
      }
    }
  };

  const writeMessage = async ({ text: messageText = "", img }) => {
    const messageId = crypto.randomUUID();
    await setDoc(doc(db, "chats", chatId, "messages", messageId), {
      id: messageId,
      senderId: currentUser.id,
      text: messageText,
      ...(img ? { img } : {}),
      createdAt: serverTimestamp(),
    });
  };

  const handleSend = async () => {
    if (text === "" || !user || isChatBlocked || isSending) return;

    setIsSending(true);
    shouldStickToBottomRef.current = true;
    try {
      await writeMessage({ text });
      await syncSidebarPreview(text);
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
      const imgUrl = await upload(file, { uid: currentUser.id });
      if (!imgUrl) {
        toast.error("Failed to upload image. Please try again.");
        return;
      }

      const caption = text.trim();
      await writeMessage({ text: caption, img: imgUrl });
      await syncSidebarPreview(caption || "Photo");
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
        {/* Active chat partner — populated from chatStore when a chat is selected */}
        <div className="user">
          <img
            src={user?.avatar || "./avatar.png"}
            alt={user?.username ?? "Chat partner"}
          />
          <div className="texts">
            <span>{user?.username ?? "Unknown user"}</span>
            <p>{user?.email ?? ""}</p>
          </div>
        </div>
        {/* ---- ICONS ---- */}
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          <button
            type="button"
            className="iconButton"
            onClick={toggleDetails}
            aria-label="Toggle chat details"
          >
            <img src="./info.png" alt="" />
          </button>
        </div>
      </div>

      {/* ------ CENTER ------ */}
      <div className="center" ref={centerRef} onScroll={handleCenterScroll}>
        {isLoadingOlder && <p className="loadOlderHint">Loading earlier messages…</p>}
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
        {messages.map((message, index) => (
          <div
            className={`message ${
              message.senderId === currentUser.id && "own"
            }`}
            key={message.id ?? `${message.senderId}-${index}`}
          >
            <div className="texts">
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
              <span>{formatMessageTime(message.createdAt)}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* Disable composer when either party has blocked the other */}
      <div className={`bottom ${isChatBlocked ? "disabled" : ""}`}>
        <div className="icons">
          <label
            className={`attachImage${isChatBlocked || isSending ? " disabled" : ""}`}
            aria-label="Send an image"
          >
            <img src="./img.png" alt="" />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              disabled={isChatBlocked || isSending}
              onChange={handleImageSelect}
            />
          </label>
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={isChatBlocked || isSending}
        />
        <div className="emoji" ref={emojiRef}>
          <img
            src="./emoji.png"
            alt="Open emoji picker"
            onClick={() =>
              !isChatBlocked && !isSending && setOpenEmoji((prev) => !prev)
            }
          />
          {openEmoji && !isChatBlocked && (
            <div className="picker">
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
