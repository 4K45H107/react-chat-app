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

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState([]);

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

  const handleSend = async () => {
    if (text === "" || !user || isChatBlocked) return;

    try {
      // 1. Append the new message to the shared chat document
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          id: crypto.randomUUID(),
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
        }),
      });

      // 2. Update each participant's userChats sidebar entry.
      //    Both the sender and receiver need their own userChats doc updated
      //    so lastMessage, isSeen, and updatedAt stay in sync on both sides.
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

          chats[chatIndex].lastMessage = text;
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

      setText("");
    } catch (error) {
      console.error(
        "[Chat] Failed to send message:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to send message. Please try again.");
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
              <p>{message.text}</p>
              <span>{formatMessageTime(message.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <div ref={endRef}></div>
      {/* Disable composer when either party has blocked the other */}
      <div className={`bottom ${isChatBlocked ? "disabled" : ""}`}>
        <div className="icons">
          <img src="./img.png" alt="" />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          value={text || ""}
          placeholder={
            isChatBlocked ? "Messaging unavailable" : "Type a message..."
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={isChatBlocked}
        />
        <div className="emoji" ref={emojiRef}>
          <img
            src="./emoji.png"
            alt="Open emoji picker"
            onClick={() => !isChatBlocked && setOpenEmoji((prev) => !prev)}
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
          disabled={isChatBlocked}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
