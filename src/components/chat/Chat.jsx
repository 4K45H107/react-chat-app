import React, { useState, useRef, useEffect } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
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

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");
  const [chat, setChat] = useState([]);

  const { chatId, user } = useChatStore();
  const { currentUser } = useUserStore();

  const endRef = useRef(null);

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

  const handleEmoji = (e) => {
    let newText = text + e.emoji;
    setText(newText);
    setOpenEmoji(false);
  };

  const handleSend = async () => {
    if (text === "") return;

    try {
      // 1. Append the new message to the shared chat document
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
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
        // Each user has their own userChats/{uid} document — must use
        // participantId here, NOT currentUser.id, or the receiver never updates.
        const userChatsRef = doc(db, "userChats", participantId);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (!userChatsSnapshot.exists()) continue;

        const userChatsData = userChatsSnapshot.data();
        const chatIndex = userChatsData.chats.findIndex(
          (c) => c.chatId === chatId
        );

        // Skip if this user's chat list doesn't contain this conversation
        if (chatIndex === -1) continue;

        // Sender marks their own chat as seen; receiver gets isSeen: false
        userChatsData.chats[chatIndex].lastMessage = text;
        userChatsData.chats[chatIndex].isSeen =
          participantId === currentUser.id;
        userChatsData.chats[chatIndex].updatedAt = Date.now();

        await updateDoc(userChatsRef, {
          chats: userChatsData.chats,
        });
      }

      // Clear input only after all writes succeed so failed sends keep the draft
      setText("");
    } catch (error) {
      console.error(
        "[Chat] Failed to send message:",
        error.code,
        error.message,
        error
      );
    }
  };

  return (
    <div className="chat">
      {/* ------ TOP ------ */}
      <div className="top">
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
          <img src="./info.png" alt="" />
        </div>
      </div>

      {/* ------ CENTER ------ */}
      <div className="center">
        {/* ----- OTHER MESSAGE ----- */}
        {/* ----- OWN MESSAGE ----- */}
        {chat?.messages?.map((message) => (
          <div
            className={`message ${
              message.senderId === currentUser.id && "own"
            }`}
            key={message.createdAt}
          >
            <div className="texts">
              <p>{message.text}</p>
              <span>1 min ago</span>
            </div>
          </div>
        ))}
        {/* {chat?.messages?.map((message) => {
          <div className="message own" key={message?.createdAt}>
            <img src="./avatar.png" alt="" />
            <div className="texts">
              {message?.img && (
                <img src="https://picsum.photos/200/300" alt="" />
              )}
              <p>{message.text}</p>
              <span>1 min ago</span>
            </div>
          </div>;
        })} */}
      </div>
      <div ref={endRef}></div>
      {/* ------ BOTTOM ------ */}
      <div className="bottom">
        <div className="icons">
          <img src="./img.png" alt="" />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          value={text || ""}
          placeholder="Type a message..."
          onChange={(e) => setText(e.target.value)}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt=""
            onClick={() => setOpenEmoji((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={openEmoji} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button className="sendButton" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
