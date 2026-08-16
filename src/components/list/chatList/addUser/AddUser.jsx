import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AddUser.css";
import { toast } from "react-toastify";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";
import { normalizeUser } from "../../../../lib/normalizeUser";
import { createChat, hasExistingChatWith } from "../../../../lib/chatService";
import { rateLimitToastMessage } from "../../../../lib/rateLimit";

const USER_LIST_LIMIT = 100;

const AddUser = ({ onClose }) => {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [addingUserId, setAddingUserId] = useState(null);
  const { currentUser } = useUserStore();
  // Sync lock — setState alone cannot stop double-clicks in the same tick
  const isAddingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isAddingRef.current) onClose?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "users"),
            orderBy("username"),
            limit(USER_LIST_LIMIT)
          )
        );

        if (cancelled) return;

        const list = snap.docs
          .map((userDoc) => normalizeUser({ id: userDoc.id, ...userDoc.data() }))
          .filter((user) => user?.id && user.id !== currentUser.id);

        setUsers(list);
      } catch (error) {
        console.error(
          "[AddUser] Failed to load users:",
          error.code,
          error.message,
          error
        );
        if (!cancelled) {
          toast.error("Failed to load users. Please try again.");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      (user.username ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleAdd = async (user) => {
    if (!user?.id || isAddingRef.current) return;

    if (user.id === currentUser.id) {
      toast.warn("You can't start a chat with yourself.");
      return;
    }

    isAddingRef.current = true;
    setAddingUserId(user.id);

    try {
      const alreadyChatting = await hasExistingChatWith(
        currentUser.id,
        user.id
      );

      if (alreadyChatting) {
        toast.warn(`You're already chatting with ${user.username}.`);
        return;
      }

      await createChat({
        currentUserId: currentUser.id,
        otherUserId: user.id,
      });

      toast.success(`Chat with ${user.username} created!`);
      onClose?.();
    } catch (error) {
      console.error(
        "[AddUser] Failed to create chat:",
        error.code,
        error.message,
        error
      );
      const limited = rateLimitToastMessage(error);
      if (limited) toast.warn(limited);
      else toast.error("Failed to create chat. Please try again.");
    } finally {
      isAddingRef.current = false;
      setAddingUserId(null);
    }
  };

  const isBusy = addingUserId != null;

  return createPortal(
    <>
      <div
        className="addUserBackdrop"
        onClick={() => !isBusy && onClose?.()}
        aria-hidden="true"
      />
      <div
        className="addUser"
        role="dialog"
        aria-modal="true"
        aria-label="Add user"
      >
        <button
          className="closeBtn"
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={isBusy}
        >
          ×
        </button>

        <label className="searchLabel" htmlFor="add-user-search">
          Find people
        </label>
        <input
          id="add-user-search"
          type="search"
          placeholder="Filter by username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isBusy}
          autoComplete="off"
          aria-label="Filter users by username"
        />

        <div className="userList" role="list" aria-label="Suggested users">
          {isLoadingUsers ? (
            <p className="listHint" aria-busy="true">
              Loading users…
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="listHint">
              {users.length === 0
                ? "No other users yet."
                : `No usernames match “${search.trim()}”.`}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const rowBusy = addingUserId === user.id;
              return (
                <div className="user" key={user.id} role="listitem">
                  <div className="details">
                    <img
                      src={user.avatar || "./avatar.png"}
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{user.username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(user)}
                    disabled={isBusy}
                    aria-label={`Start chat with ${user.username}`}
                    aria-busy={rowBusy}
                  >
                    {rowBusy ? "…" : "+"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default AddUser;
