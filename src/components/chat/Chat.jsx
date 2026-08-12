import React, { useState, useRef, useEffect } from "react";
import "./chat.css";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { toast } from "react-toastify";
import { db } from "../../lib/firebase";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { formatMessageTime } from "../../lib/formatTime";
import upload from "../../lib/upload";

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState([]);
  const [isSending, setIsSending] = useState(false);

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
  const emojiRef = useRef(null);
  const imageInputRef = useRef(null);

  // Scroll to the latest message whenever the message list updates
  // (new incoming message, own send via snapshot, or opening a chat)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "chats", chatId),
      (res) => {
        setChat(res.data());
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

  const handleSend = async () => {
    if (text === "" || !user || isChatBlocked || isSending) return;

    setIsSending(true);
    try {
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          id: crypto.randomUUID(),
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
        }),
      });

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
    try {
      const imgUrl = await upload(file, { uid: currentUser.id });
      if (!imgUrl) {
        toast.error("Failed to upload image. Please try again.");
        return;
      }

      const caption = text.trim();
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          id: crypto.randomUUID(),
          senderId: currentUser.id,
          text: caption,
          img: imgUrl,
          createdAt: new Date(),
        }),
      });

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
      <div className="center">
        {isChatBlocked && (
          <p className="blockedNotice">
            {isCurrentUserBlocked
              ? "You can't message this user — you've been blocked."
              : "You blocked this user."}
          </p>
        )}
        {!chat?.messages?.length && !isChatBlocked && (
          <p className="emptyMessages">
            No messages yet. Say hello to start the conversation.
          </p>
        )}
        {chat?.messages?.map((message, index) => (
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
      </div>
      <div ref={endRef}></div>
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
