import React, { useEffect, useRef, useState } from "react";
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
import upload from "../../lib/upload";
import {
  leaveGroupChat,
  updateGroupAvatar,
  updateOwnChatFlags,
} from "../../lib/chatService";
import { rateLimitToastMessage } from "../../lib/rateLimit";

const Details = () => {
  const {
    chatId,
    user,
    isGroup,
    groupName,
    groupAvatar,
    members,
    participantIds,
    isReceiverBlocked,
    closeChat,
  } = useChatStore();
  const { currentUser } = useUserStore();
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isUpdatingFlags, setIsUpdatingFlags] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [muted, setMuted] = useState(false);
  const [archived, setArchived] = useState(false);
  const avatarInputRef = useRef(null);

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

  useEffect(() => {
    if (!isGroup || !chatId) return;

    const unSub = onSnapshot(
      doc(db, "chats", chatId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        useChatStore.setState({
          groupAvatar: data.avatar || null,
          groupName: data.name || "Group",
          participantIds: data.participantIds ?? [],
        });
      },
      (error) => {
        console.warn(
          "[Details] Failed to listen for group meta:",
          error.code,
          error.message
        );
      }
    );

    return () => unSub();
  }, [isGroup, chatId]);

  const handleToggleBlock = async () => {
    if (isGroup || !user?.id || !currentUser?.id || isUpdatingBlock) return;

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

  const handleLeaveGroup = async () => {
    if (!isGroup || !currentUser?.id || !chatId || isLeaving) return;

    setIsLeaving(true);
    try {
      await leaveGroupChat({ chatId, userId: currentUser.id });
      toast.success("Left the group");
      closeChat();
    } catch (error) {
      console.error(
        "[Details] Failed to leave group:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to leave group. Please try again.");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleGroupAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isGroup || !chatId || !currentUser?.id || isUploadingAvatar) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.warn("Please choose an image file.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const imageUrl = await upload(file, { uid: currentUser.id });
      if (!imageUrl) {
        toast.error("Failed to upload photo. Please try again.");
        return;
      }

      await updateGroupAvatar({
        chatId,
        avatarUrl: imageUrl,
        currentUserId: currentUser.id,
      });
      useChatStore.setState({ groupAvatar: imageUrl });
      toast.success("Group photo updated");
    } catch (error) {
      console.error(
        "[Details] Failed to update group avatar:",
        error.code || error,
        error.message || error
      );
      const limited = rateLimitToastMessage(error);
      if (limited) toast.warn(limited);
      else toast.error("Failed to update group photo. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const memberCount = participantIds?.length || (members?.length ?? 0) + 1;

  return (
    <div className="details">
      <div className="user">
        {isGroup ? (
          groupAvatar ? (
            <img src={groupAvatar} alt={groupName || "Group"} />
          ) : (
            <div className="groupAvatarLarge" aria-hidden="true">
              {(groupName || "G").slice(0, 1).toUpperCase()}
            </div>
          )
        ) : (
          <img
            src={user?.avatar || "./avatar.png"}
            alt={user?.username ?? "Chat partner"}
          />
        )}
        <h2>
          {isGroup ? groupName || "Group" : user?.username ?? "Unknown user"}
        </h2>
        <p>
          {isGroup
            ? `${memberCount} members`
            : (user?.email ?? "")}
        </p>
        {isGroup && (
          <>
            <input
              ref={avatarInputRef}
              id="group-avatar-upload"
              type="file"
              accept="image/*"
              hidden
              onChange={handleGroupAvatarSelect}
            />
            <button
              type="button"
              className="groupAvatarBtn"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar
                ? "Uploading…"
                : groupAvatar
                  ? "Change group photo"
                  : "Upload group photo"}
            </button>
          </>
        )}
      </div>
      <div className="info">
        {isGroup && (
          <div className="option">
            <div className="title">
              <span>Members</span>
            </div>
            <ul className="memberList">
              <li className="memberRow">
                <img
                  src={currentUser?.avatar || "./avatar.png"}
                  alt=""
                  aria-hidden="true"
                />
                <span>
                  {currentUser?.username || "You"}
                  <em> (you)</em>
                </span>
              </li>
              {(members ?? []).map((member) => (
                <li className="memberRow" key={member.id}>
                  <img
                    src={member.avatar || "./avatar.png"}
                    alt=""
                    aria-hidden="true"
                  />
                  <span>{member.username || "Member"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {isGroup ? (
          <button
            className="btn-blk"
            type="button"
            onClick={handleLeaveGroup}
            disabled={isLeaving}
          >
            {isLeaving ? "Leaving…" : "Leave group"}
          </button>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default Details;
