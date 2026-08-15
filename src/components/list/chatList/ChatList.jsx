import React, { useEffect, useRef, useState } from "react";
import "./ChatList.css";
import { toast } from "react-toastify";
import AddUser from "./addUser/AddUser";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { normalizeUser } from "../../../lib/normalizeUser";
import {
  ensureNotificationPermission,
  getUnreadNotificationTargets,
  showChatNotification,
} from "../../../lib/notifications";

const ChatList = () => {
  const [addMode, setAddMode] = useState(false);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const previousChatsRef = useRef(null);

  const { currentUser } = useUserStore();
  const { changeChat, chatId } = useChatStore();
  const activeChatIdRef = useRef(chatId);
  activeChatIdRef.current = chatId;

  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoadingList(true);
    previousChatsRef.current = null;
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
          chatList.sort((a, b) => b.updatedAt - a.updatedAt);

          const targets = getUnreadNotificationTargets(
            chatList,
            previousChatsRef.current,
            activeChatIdRef.current
          );

          previousChatsRef.current = new Map(
            chatList.map((chat) => [
              chat.chatId,
              {
                updatedAt: chat.updatedAt,
                lastMessage: chat.lastMessage,
              },
            ])
          );

          for (const chat of targets) {
            showChatNotification({
              title: chat.user?.username || "New message",
              body: chat.lastMessage,
              tag: chat.chatId,
              onClick: () => changeChat(chat.chatId, chat.user),
            });
          }

          setChats(chatList);
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
  }, [currentUser.id, changeChat]);

  const handleSelectChat = (chat) => {
    if (!chat.user) return;
    changeChat(chat.chatId, chat.user);
  };

  const searchQuery = search.trim().toLowerCase();
  const archivedCount = chats.filter((chat) => chat.archived).length;

  const filteredChats = chats.filter((chat) => {
    const inArchiveView = showArchived ? chat.archived : !chat.archived;
    if (!inArchiveView) return false;
    if (!searchQuery) return true;

    const username = chat.user?.username?.toLowerCase() ?? "";
    const lastMessage = chat.lastMessage?.toLowerCase() ?? "";
    return username.includes(searchQuery) || lastMessage.includes(searchQuery);
  });

  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search chats"
          />
        </div>
        <button
          type="button"
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
          aria-label={addMode ? "Close add user" : "Add user"}
          aria-expanded={addMode}
        >
          <img
            src={!addMode ? "./plus.png" : "./minus.png"}
            alt=""
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="listToolbar">
        <button
          type="button"
          className={`archiveToggle${showArchived ? " active" : ""}`}
          onClick={() => setShowArchived((prev) => !prev)}
          aria-pressed={showArchived}
        >
          {showArchived
            ? "Back to chats"
            : `Archived${archivedCount ? ` (${archivedCount})` : ""}`}
        </button>
      </div>

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
            : showArchived
              ? "No archived chats."
              : "No chats yet. Tap + to start one."}
        </p>
      ) : (
        filteredChats.map((chat) => (
          <div
            className={`item${!chat.isSeen ? " unread" : ""}${
              chat.muted ? " muted" : ""
            }`}
            key={chat.chatId}
            onClick={() => handleSelectChat(chat)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelectChat(chat);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open chat with ${chat.user.username}${
              !chat.isSeen ? ", unread" : ""
            }${chat.muted ? ", muted" : ""}${
              chat.archived ? ", archived" : ""
            }`}
          >
            <img
              src={chat.user.avatar || "./avatar.png"}
              alt=""
              aria-hidden="true"
            />
            <div className="texts">
              <span>
                {chat.user.username}
                {chat.muted ? " · muted" : ""}
              </span>
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
