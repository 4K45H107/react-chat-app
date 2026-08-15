import React, { useEffect, useRef, useState } from "react";
import "./ChatList.css";
import { toast } from "react-toastify";
import AddUser from "./addUser/AddUser";
import CreateGroup from "./createGroup/CreateGroup";
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

const loadUserProfile = async (userId) => {
  if (!userId || typeof userId !== "string") return null;

  try {
    const userDocSnap = await getDoc(doc(db, "users", userId));
    if (!userDocSnap.exists()) return null;
    return normalizeUser({ id: userDocSnap.id, ...userDocSnap.data() });
  } catch (error) {
    console.error(
      "[ChatList] Failed to load user profile:",
      userId,
      error.code,
      error.message,
      error
    );
    return null;
  }
};

const ChatList = () => {
  const [modalMode, setModalMode] = useState(null); // "dm" | "group" | null
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
            if (item.isGroup) {
              try {
                const chatSnap = await getDoc(doc(db, "chats", item.chatId));
                const chatData = chatSnap.exists() ? chatSnap.data() : {};
                const participantIds = chatData.participantIds ?? [];
                const groupName =
                  chatData.name || item.groupName || "Group";
                const groupAvatar =
                  chatData.avatar || item.groupAvatar || null;

                const otherIds = participantIds.filter(
                  (id) => typeof id === "string" && id && id !== currentUser.id
                );
                const members = (
                  await Promise.all(
                    otherIds.slice(0, 12).map((id) => loadUserProfile(id))
                  )
                ).filter(Boolean);

                return {
                  ...item,
                  isGroup: true,
                  groupName,
                  groupAvatar,
                  participantIds,
                  members,
                  user: {
                    id: item.chatId,
                    username: groupName,
                    avatar: groupAvatar || "./avatar.png",
                    blocked: [],
                  },
                };
              } catch (error) {
                console.error(
                  "[ChatList] Failed to load group chat:",
                  item.chatId,
                  error.code,
                  error.message,
                  error
                );
                return null;
              }
            }

            if (!item.receiverId) return null;

            const user = await loadUserProfile(item.receiverId);
            if (!user) {
              console.warn(
                "[ChatList] Skipping chat — user profile missing:",
                item.receiverId
              );
              return null;
            }

            return { ...item, user };
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
            const openTarget = () => {
              if (chat.isGroup) {
                changeChat(chat.chatId, {
                  isGroup: true,
                  groupName: chat.groupName,
                  groupAvatar: chat.groupAvatar,
                  participantIds: chat.participantIds,
                  members: chat.members,
                });
                return;
              }
              changeChat(chat.chatId, chat.user);
            };

            showChatNotification({
              title: chat.isGroup
                ? chat.groupName || "Group"
                : chat.user?.username || "New message",
              body: chat.lastMessage,
              tag: chat.chatId,
              onClick: openTarget,
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

  const openChat = (chat) => {
    if (chat.isGroup) {
      changeChat(chat.chatId, {
        isGroup: true,
        groupName: chat.groupName,
        groupAvatar: chat.groupAvatar,
        participantIds: chat.participantIds,
        members: chat.members,
      });
      return;
    }

    if (!chat.user) return;
    changeChat(chat.chatId, chat.user);
  };

  const handleSelectChat = (chat) => {
    openChat(chat);
  };

  const searchQuery = search.trim().toLowerCase();
  const archivedCount = chats.filter((chat) => chat.archived).length;

  const filteredChats = chats.filter((chat) => {
    const inArchiveView = showArchived ? chat.archived : !chat.archived;
    if (!inArchiveView) return false;
    if (!searchQuery) return true;

    const title = chat.isGroup
      ? (chat.groupName ?? "").toLowerCase()
      : (chat.user?.username?.toLowerCase() ?? "");
    const lastMessage = chat.lastMessage?.toLowerCase() ?? "";
    return title.includes(searchQuery) || lastMessage.includes(searchQuery);
  });

  const displayTitle = (chat) =>
    chat.isGroup ? chat.groupName || "Group" : chat.user?.username || "Unknown";

  return (
    <div className="chatList">
      <div className="search">
        <div className="searchBar">
          <span className="searchIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
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
          </span>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search chats"
          />
        </div>
        <button
          type="button"
          className="add"
          onClick={() =>
            setModalMode((prev) => (prev === "dm" ? null : "dm"))
          }
          aria-label={modalMode === "dm" ? "Close add user" : "Add user"}
          aria-expanded={modalMode === "dm"}
        >
          <span className="addGlyph" aria-hidden="true">
            {modalMode === "dm" ? "−" : "+"}
          </span>
        </button>
        <button
          type="button"
          className="add groupAdd"
          onClick={() =>
            setModalMode((prev) => (prev === "group" ? null : "group"))
          }
          aria-label={
            modalMode === "group" ? "Close create group" : "Create group"
          }
          aria-expanded={modalMode === "group"}
          title="New group"
        >
          <span className="addGlyph" aria-hidden="true">
            {modalMode === "group" ? "−" : "G"}
          </span>
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
              : "No chats yet. Tap + for a DM or the group button for a group."}
        </p>
      ) : (
        filteredChats.map((chat) => (
          <div
            className={`item${!chat.isSeen ? " unread" : ""}${
              chat.muted ? " muted" : ""
            }${chat.chatId === chatId ? " selected" : ""}${
              chat.isGroup ? " group" : ""
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
            aria-current={chat.chatId === chatId ? "true" : undefined}
            aria-label={`Open ${chat.isGroup ? "group" : "chat with"} ${displayTitle(
              chat
            )}${!chat.isSeen ? ", unread" : ""}${
              chat.muted ? ", muted" : ""
            }${chat.archived ? ", archived" : ""}${
              chat.chatId === chatId ? ", selected" : ""
            }`}
          >
            {chat.isGroup ? (
              chat.groupAvatar ? (
                <img
                  src={chat.groupAvatar}
                  alt=""
                  aria-hidden="true"
                />
              ) : (
                <div className="groupAvatar" aria-hidden="true">
                  {(chat.groupName || "G").slice(0, 1).toUpperCase()}
                </div>
              )
            ) : (
              <img
                src={chat.user.avatar || "./avatar.png"}
                alt=""
                aria-hidden="true"
              />
            )}
            <div className="texts">
              <span>
                {displayTitle(chat)}
                {chat.isGroup ? " · group" : ""}
                {chat.muted ? " · muted" : ""}
              </span>
              <p>{chat.lastMessage}</p>
            </div>
          </div>
        ))
      )}

      {modalMode === "dm" && (
        <AddUser onClose={() => setModalMode(null)} />
      )}
      {modalMode === "group" && (
        <CreateGroup onClose={() => setModalMode(null)} />
      )}
    </div>
  );
};

export default ChatList;
