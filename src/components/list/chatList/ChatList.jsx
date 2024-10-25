import React, { useEffect, useState } from "react";
import "./ChatList.css";
import AddUser from "./addUser/AddUser";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const ChatList = () => {
  const [addMode, setAddMode] = useState(false);
  const [chats, setChats] = useState([]);

  const { currentUser } = useUserStore();
  const { changeChat } = useChatStore();

  useEffect(() => {
    // Get chats from firestore
    // onSnapshot is a listener that listens for changes to the document
    const unSub = onSnapshot(
      doc(db, "userChats", currentUser.id),
      async (res) => {
        // Get user info for each chat
        // getDoc is a function that gets a document from Firestore
        const items = res.data().chats;
        const promises = items.map(async (item) => {
          const userDocRef = doc(db, "users", item.receiverId);
          const userDocSnap = await getDoc(userDocRef);
          const user = userDocSnap.data();
          return { ...item, user };
        });

        const chatList = await Promise.all(promises);
        // show the latest message first
        setChats(chatList.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    );

    console.log(chats);

    return () => unSub();
  }, [currentUser.id]);

  const handleSearch = async (chat) => {
    changeChat(chat.chatId, chat.user);
  };

  return (
    <div className="chatList">
      {/* ------ SEARCH ------ */}
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input type="text" placeholder="Search" />
        </div>
        <img
          src={!addMode ? "./plus.png" : "./minus.png"}
          alt=""
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>

      {/* ------ ITEMS ------ */}
      {chats.map((chat) => (
        <div
          className="item"
          key={chat.chatId}
          onClick={() => handleSearch(chat)}
        >
          <img src={chat.user.avatar || "./avatar.png"} alt="" />
          <div className="texts">
            <span>{chat.user.username}</span>
            <p>{chat.lastMessage}</p>
          </div>
        </div>
      ))}

      {addMode && <AddUser />}
    </div>
  );
};

export default ChatList;
