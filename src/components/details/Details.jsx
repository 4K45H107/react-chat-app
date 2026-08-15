import React, { useEffect, useState } from "react";
import "./details.css";
import { toast } from "react-toastify";
import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { normalizeUser } from "../../lib/normalizeUser";
import { updateOwnChatFlags } from "../../lib/chatService";

const Details = () => {
  const { chatId, user, isReceiverBlocked, closeChat } = useChatStore();
  const { currentUser } = useUserStore();
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isUpdatingFlags, setIsUpdatingFlags] = useState(false);
  const [muted, setMuted] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (!currentUser?.id || !chatId) return;

    const unSub = onSnapshot(
      doc(db, "userChats", currentUser.id),
      (snap) => {
        const entry = (snap.data()?.chats ?? []).find(
          (chat) => chat.chatId === chatId
        );
        setMuted(Boolean(entry?.muted));
        setArchived(Boolean(entry?.archived));
      },
      (error) => {
        console.warn(
          "[Details] Failed to listen for chat flags:",
          error.code,
          error.message
        );
      }
    );

    return () => unSub();
  }, [currentUser?.id, chatId]);

  const handleToggleBlock = async () => {
    if (!user?.id || !currentUser?.id || isUpdatingBlock) return;

    setIsUpdatingBlock(true);
    try {
      if (isReceiverBlocked) {
        await updateDoc(doc(db, "users", currentUser.id), {
          blocked: arrayRemove(user.id),
        });

        useUserStore.setState({
          currentUser: normalizeUser({
            ...currentUser,
            blocked: currentUser.blocked.filter((id) => id !== user.id),
          }),
        });
        useChatStore.setState({ isReceiverBlocked: false });
        toast.success(`Unblocked ${user.username}`);
      } else {
        await updateDoc(doc(db, "users", currentUser.id), {
          blocked: arrayUnion(user.id),
        });

        useUserStore.setState({
          currentUser: normalizeUser({
            ...currentUser,
            blocked: [...currentUser.blocked, user.id],
          }),
        });
        useChatStore.setState({ isReceiverBlocked: true });
        toast.success(`Blocked ${user.username}`);
      }
    } catch (error) {
      console.error(
        "[Details] Failed to update block status:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to update block status. Please try again.");
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  const handleToggleFlag = async (flag) => {
    if (!currentUser?.id || !chatId || isUpdatingFlags) return;

    setIsUpdatingFlags(true);
    try {
      if (flag === "muted") {
        const next = !muted;
        await updateOwnChatFlags(currentUser.id, chatId, { muted: next });
        toast.success(next ? "Chat muted" : "Chat unmuted");
      } else if (flag === "archived") {
        const next = !archived;
        await updateOwnChatFlags(currentUser.id, chatId, { archived: next });
        toast.success(next ? "Chat archived" : "Chat unarchived");
        if (next) closeChat();
      }
    } catch (error) {
      console.error(
        "[Details] Failed to update chat flags:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to update chat settings. Please try again.");
    } finally {
      setIsUpdatingFlags(false);
    }
  };

  return (
    <div className="details">
      <div className="user">
        <img
          src={user?.avatar || "./avatar.png"}
          alt={user?.username ?? "Chat partner"}
        />
        <h2>{user?.username ?? "Unknown user"}</h2>
        <p>{user?.email ?? ""}</p>
      </div>
      <div className="info">
        <div className="option">
          <div className="title">
            <span>Chat settings</span>
          </div>
          <div className="settingActions">
            <button
              type="button"
              className="settingBtn"
              onClick={() => handleToggleFlag("muted")}
              disabled={isUpdatingFlags}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              className="settingBtn"
              onClick={() => handleToggleFlag("archived")}
              disabled={isUpdatingFlags}
            >
              {archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>

        <div className="option">
          <div className="title">
            <span>Privacy & help</span>
            <img src="./arrowUp.png" alt="" aria-hidden="true" />
          </div>
        </div>

        <div className="option">
          <div className="title">
            <span>Shared photos</span>
            <img src="./arrowDown.png" alt="" aria-hidden="true" />
          </div>
          <div className="photos">
            <p className="emptyHint">No shared photos yet</p>
          </div>
        </div>

        <div className="option">
          <div className="title">
            <span>Shared files</span>
            <img src="./arrowUp.png" alt="" aria-hidden="true" />
          </div>
        </div>

        <button
          className="btn-blk"
          type="button"
          onClick={handleToggleBlock}
          disabled={isUpdatingBlock}
        >
          {isUpdatingBlock
            ? "Updating..."
            : isReceiverBlocked
              ? "Unblock User"
              : "Block User"}
        </button>
      </div>
    </div>
  );
};

export default Details;
