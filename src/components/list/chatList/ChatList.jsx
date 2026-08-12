import React, { useEffect, useState } from "react";
import "./ChatList.css";
import { toast } from "react-toastify";
import AddUser from "./addUser/AddUser";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { normalizeUser } from "../../../lib/normalizeUser";

const ChatList = () => {
  const [addMode, setAddMode] = useState(false);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);

  const { currentUser } = useUserStore();
  const { changeChat } = useChatStore();

  useEffect(() => {
    setIsLoadingList(true);
    // Get chats from firestore
    // onSnapshot is a listener that listens for changes to the document
    const unSub = onSnapshot(
      doc(db, "userChats", currentUser.id),
      async (res) => {
        try {
          const items = res.data()?.chats ?? [];

          const promises = items.map(async (item) => {
            try {
              const userDocSnap = await getDoc(
                doc(db, "users", item.receiverId)
              );

              if (!userDocSnap.exists()) {
                console.warn(
                  "[ChatList] Skipping chat — user profile missing:",
                  item.receiverId
                );
                return null;
              }

              return { ...item, user: normalizeUser(userDocSnap.data()) };
            } catch (error) {
              console.error(
                "[ChatList] Failed to load user profile:",
                item.receiverId,
                error.code,
                error.message,
                error
              );
              return null;
            }
          });

          const chatList = (await Promise.all(promises)).filter(Boolean);
          setChats(chatList.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch (error) {
          console.error(
            "[ChatList] Failed to process chat list:",
            error.code,
            error.message,
            error
          );
          toast.error("Failed to load chat list. Please try again.");
        } finally {
          setIsLoadingList(false);
        }
      },
      (error) => {
        console.error(
          "[ChatList] Failed to listen to userChats:",
          error.code,
          error.message,
          error
        );
        toast.error("Failed to load chat list. Please try again.");
        setIsLoadingList(false);
      }
    );

    return () => unSub();
  }, [currentUser.id]);

  const handleSelectChat = (chat) => {
    if (!chat.user) return;
    changeChat(chat.chatId, chat.user);
  };

  const searchQuery = search.trim().toLowerCase();
  const filteredChats = searchQuery
    ? chats.filter((chat) => {
        const username = chat.user?.username?.toLowerCase() ?? "";
        const lastMessage = chat.lastMessage?.toLowerCase() ?? "";
        return (
          username.includes(searchQuery) || lastMessage.includes(searchQuery)
        );
      })
    : chats;

  return (
    <div className="chatList">
      {/* ------ SEARCH ------ */}
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search chats"
          />
        </div>
        <img
          src={!addMode ? "./plus.png" : "./minus.png"}
          alt=""
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>

      {/* ------ ITEMS ------ */}
      {isLoadingList ? (
        <div className="listSkeleton" aria-busy="true" aria-label="Loading chats">
          <div className="skeletonItem" />
          <div className="skeletonItem" />
          <div className="skeletonItem" />
        </div>
      ) : filteredChats.length === 0 ? (
        <p className="emptyState">
          {searchQuery
            ? "No chats match your search."
            : "No chats yet. Tap + to start one."}
        </p>
      ) : (
        filteredChats.map((chat) => (
          <div
            className={`item${!chat.isSeen ? " unread" : ""}`}
            key={chat.chatId}
            onClick={() => handleSelectChat(chat)}
          >
            <img src={chat.user.avatar || "./avatar.png"} alt="" />
            <div className="texts">
              <span>{chat.user.username}</span>
              <p>{chat.lastMessage}</p>
            </div>
          </div>
        ))
      )}

      {addMode && <AddUser onClose={() => setAddMode(false)} />}
    </div>
  );
};

export default ChatList;
