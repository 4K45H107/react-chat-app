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

  useEffect(() => {
    endRef.current.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "chats", chatId), (res) => {
      setChat(res.data());
    });

    return () => unsub();
  }, [chatId]);

  const handleEmoji = (e) => {
    let newText = text + e.emoji;
    setText(newText);
    setOpenEmoji(false);
  };

  const handleSend = async () => {
    // if text is empty, return
    if (text === "") return;

    try {
      // update the chat with the new message
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
        }),
      });

      // update the userChats in both ends
      const userIDs = [currentUser.id, user.id];

      userIDs.forEach(async (id) => {
        // update the userChats with the new message
        const userChatsRef = doc(db, "userChats", currentUser.id);
        const userChatSnapShot = await getDoc(userChatsRef);

        if (userChatSnapShot.exists()) {
          const userChatsData = userChatSnapShot.data();

          // find the chat in the userChats
          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );

          // update the chat last message, isSeen, updatedAt
          userChatsData.chats[chatIndex].lastMessage = text;
          userChatsData.chats[chatIndex].isSeen =
            id === currentUser.id ? true : false;
          userChatsData.chats[chatIndex].updatedAt = Date.now();

          await updateDoc(userChatsRef, {
            chats: userChatsData.chats,
          });
        }
      });

      console.log(chat);
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <div className="chat">
      {/* ------ TOP ------ */}
      <div className="top">
        {/* ------ USER INFO ------ */}
        <div className="user">
          <img src="./avatar.png" alt="" />
          <div className="texts">
            <span>Safina Promity</span>
            <p>I am safina</p>
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
