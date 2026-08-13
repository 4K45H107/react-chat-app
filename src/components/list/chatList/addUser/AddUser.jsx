import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./AddUser.css";
import { toast } from "react-toastify";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";
import { createChat, hasExistingChatWith } from "../../../../lib/chatService";

const AddUser = ({ onClose }) => {
  const [user, setUser] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
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

  const handleUserSearch = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const username = String(formData.get("username") ?? "").trim();

    if (!username) {
      setUser(null);
      toast.warn("Please enter a username to search.");
      return;
    }

    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", username));
      const querySnapShot = await getDocs(q);

      if (!querySnapShot.empty) {
        const foundUser = querySnapShot.docs[0].data();

        if (foundUser.id === currentUser.id) {
          setUser(null);
          toast.warn("You can't start a chat with yourself.");
          return;
        }

        setUser(foundUser);
      } else {
        setUser(null);
        console.warn("[AddUser] No user found for username:", username);
        toast.warn(`No user found with username "${username}"`);
      }
    } catch (error) {
      console.error(
        "[AddUser] User search failed:",
        error.code,
        error.message,
        error
      );
      toast.error("User search failed. Please try again.");
    }
  };

  const handleAdd = async () => {
    if (!user?.id || isAddingRef.current) return;

    if (user.id === currentUser.id) {
      toast.warn("You can't start a chat with yourself.");
      return;
    }

    isAddingRef.current = true;
    setIsAdding(true);

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

      toast.success("Chat created!");
      setUser(null);
      onClose?.();
    } catch (error) {
      console.error(
        "[AddUser] Failed to create chat:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to create chat. Please try again.");
    } finally {
      isAddingRef.current = false;
      setIsAdding(false);
    }
  };

  return createPortal(
    <>
      <div
        className="addUserBackdrop"
        onClick={() => !isAdding && onClose?.()}
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
          disabled={isAdding}
        >
          ×
        </button>
        <form onSubmit={handleUserSearch}>
          <input
            type="text"
            placeholder="Username"
            name="username"
            disabled={isAdding}
          />
          <button type="submit" disabled={isAdding}>
            Search
          </button>
        </form>

        {user && (
          <div className="user">
            <div className="details">
              <img src={user.avatar || "./avatar.png"} alt="" />
              <span>{user.username}</span>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding}
              aria-busy={isAdding}
            >
              {isAdding ? "…" : "+"}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default AddUser;
