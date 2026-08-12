import React, { useState } from "react";
import "./details.css";
import { toast } from "react-toastify";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import { normalizeUser } from "../../lib/normalizeUser";

const Details = () => {
  const { user, isReceiverBlocked } = useChatStore();
  const { currentUser } = useUserStore();
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

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

  return (
    <div className="details">
      {/* Active chat partner — same user object as the Chat header */}
      <div className="user">
        <img
          src={user?.avatar || "./avatar.png"}
          alt={user?.username ?? "Chat partner"}
        />
        <h2>{user?.username ?? "Unknown user"}</h2>
        <p>{user?.email ?? ""}</p>
      </div>
      {/* ----- INFO ----- */}
      <div className="info">
        {/* ----- OPTION 1 ----- */}
        <div className="option">
          <div className="title">
            <span>Chat settings</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>

        {/* ----- OPTION 2 ----- */}
        <div className="option">
          <div className="title">
            <span>Privacy & help</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>

        {/* ----- OPTION 3 ----- */}
        <div className="option">
          <div className="title">
            <span>Shared photos</span>
            <img src="./arrowDown.png" alt="" />
          </div>

          {/* Shared photos not implemented yet — placeholder removed */}
          <div className="photos">
            <p className="emptyHint">No shared photos yet</p>
          </div>
        </div>

        {/* ----- OPTION 4 ----- */}
        <div className="option">
          <div className="title">
            <span>Shared files</span>
            <img src="./arrowUp.png" alt="" />
          </div>
        </div>

        {/* ----- BLOCK / UNBLOCK ----- */}
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
