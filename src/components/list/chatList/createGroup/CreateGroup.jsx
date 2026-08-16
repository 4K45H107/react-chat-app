import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../addUser/AddUser.css";
import "./CreateGroup.css";
import { toast } from "react-toastify";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";
import { normalizeUser } from "../../../../lib/normalizeUser";
import { createGroupChat } from "../../../../lib/chatService";
import { rateLimitToastMessage } from "../../../../lib/rateLimit";

const USER_LIST_LIMIT = 100;
const MAX_GROUP_NAME = 60;

const CreateGroup = ({ onClose }) => {
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { currentUser } = useUserStore();
  const isCreatingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isCreatingRef.current) onClose?.();
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
          .map((userDoc) =>
            normalizeUser({ id: userDoc.id, ...userDoc.data() })
          )
          .filter((user) => user?.id && user.id !== currentUser.id);

        setUsers(list);
      } catch (error) {
        console.error(
          "[CreateGroup] Failed to load users:",
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

  const toggleMember = (userId) => {
    if (isCreatingRef.current) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (isCreatingRef.current) return;

    const name = groupName.trim();
    if (!name) {
      toast.warn("Enter a group name.");
      return;
    }
    if (selectedIds.size < 2) {
      toast.warn("Select at least 2 other people.");
      return;
    }

    isCreatingRef.current = true;
    setIsCreating(true);

    try {
      await createGroupChat({
        creatorId: currentUser.id,
        name,
        memberIds: [...selectedIds],
      });
      toast.success(`Group “${name}” created!`);
      onClose?.();
    } catch (error) {
      console.error(
        "[CreateGroup] Failed to create group:",
        error.code || error,
        error.message || error
      );
      const limited = rateLimitToastMessage(error);
      if (limited) toast.warn(limited);
      else if (error?.message?.includes("Pick at least")) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create group. Please try again.");
      }
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  return createPortal(
    <>
      <div
        className="addUserBackdrop"
        onClick={() => !isCreating && onClose?.()}
        aria-hidden="true"
      />
      <div
        className="addUser createGroup"
        role="dialog"
        aria-modal="true"
        aria-label="Create group"
      >
        <button
          className="closeBtn"
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={isCreating}
        >
          ×
        </button>

        <label className="searchLabel" htmlFor="create-group-name">
          Group name
        </label>
        <input
          id="create-group-name"
          type="text"
          placeholder="e.g. Weekend plans"
          value={groupName}
          maxLength={MAX_GROUP_NAME}
          onChange={(e) => setGroupName(e.target.value)}
          disabled={isCreating}
          autoComplete="off"
        />

        <label className="searchLabel" htmlFor="create-group-search">
          Add members ({selectedIds.size} selected)
        </label>
        <input
          id="create-group-search"
          type="search"
          placeholder="Filter by username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isCreating}
          autoComplete="off"
          aria-label="Filter users by username"
        />

        <div className="userList" role="list" aria-label="People to add">
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
              const selected = selectedIds.has(user.id);
              return (
                <button
                  type="button"
                  className={`user selectRow${selected ? " selected" : ""}`}
                  key={user.id}
                  role="listitem"
                  onClick={() => toggleMember(user.id)}
                  disabled={isCreating}
                  aria-pressed={selected}
                  aria-label={`${selected ? "Remove" : "Add"} ${user.username}`}
                >
                  <div className="details">
                    <img
                      src={user.avatar || "./avatar.png"}
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{user.username}</span>
                  </div>
                  <span className="checkMark" aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          className="createGroupBtn"
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? "Creating…" : "Create group"}
        </button>
      </div>
    </>,
    document.body
  );
};

export default CreateGroup;
