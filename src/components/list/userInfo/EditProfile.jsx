import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";
import upload from "../../../lib/upload";
import { rateLimitToastMessage } from "../../../lib/rateLimit";
import "./EditProfile.css";

const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 40;

const EditProfile = ({ onClose }) => {
  const { currentUser, fetchUserInfo } = useUserStore();
  const [username, setUsername] = useState(currentUser?.username ?? "");
  const [nameEditable, setNameEditable] = useState(false);
  const [avatar, setAvatar] = useState({
    file: null,
    url: currentUser?.avatar || "",
  });
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    return () => {
      if (avatar.file && avatar.url?.startsWith("blob:")) {
        URL.revokeObjectURL(avatar.url);
      }
    };
  }, [avatar.file, avatar.url]);

  useEffect(() => {
    if (nameEditable) nameInputRef.current?.focus();
  }, [nameEditable]);

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.warn("Please choose an image file.");
      return;
    }

    setAvatar((prev) => {
      if (prev.file && prev.url?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.url);
      }
      return { file, url: URL.createObjectURL(file) };
    });
  };

  const handleEnableNameEdit = () => {
    if (saving) return;
    setNameEditable(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || !currentUser?.id) return;

    const nextUsername = username.trim();
    if (!nextUsername) {
      toast.warn("Display name is required.");
      return;
    }

    if (nextUsername.length < MIN_DISPLAY_NAME_LENGTH) {
      toast.warn(
        `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters.`
      );
      return;
    }

    const usernameChanged = nextUsername !== currentUser.username;
    const avatarChanged = Boolean(avatar.file);

    if (!usernameChanged && !avatarChanged) {
      onClose?.();
      return;
    }

    setSaving(true);

    try {
      const updates = {};
      if (usernameChanged) updates.username = nextUsername;

      if (avatarChanged) {
        const imageUrl = await upload(avatar.file, { uid: currentUser.id });
        if (imageUrl) updates.avatar = imageUrl;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "users", currentUser.id), updates);
        await fetchUserInfo(currentUser.id);
      }

      toast.success("Profile updated.");
      onClose?.();
    } catch (error) {
      console.error(
        "[EditProfile] Failed to update profile:",
        error.code,
        error.message,
        error
      );
      const limited = rateLimitToastMessage(error);
      if (limited) toast.warn(limited);
      else toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = avatar.url || "./avatar.png";

  return createPortal(
    <>
      <div
        className="editProfileBackdrop"
        onClick={() => !saving && onClose?.()}
        aria-hidden="true"
      />
      <div
        className="editProfile"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        <button
          className="closeBtn"
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={saving}
        >
          ×
        </button>

        <h2 id="edit-profile-title">Edit profile</h2>

        <form onSubmit={handleSave}>
          <label className="avatarPicker" htmlFor="edit-profile-avatar">
            <img src={previewSrc} alt="" aria-hidden="true" />
            <span>{avatar.file ? "Change photo" : "Upload photo"}</span>
          </label>
          <input
            id="edit-profile-avatar"
            type="file"
            accept="image/*"
            onChange={handleAvatar}
            disabled={saving}
            hidden
          />

          <label className="fieldLabel" htmlFor="edit-profile-username">
            Display name
          </label>
          <div className={`nameRow${nameEditable ? " isEditing" : ""}`}>
            <input
              id="edit-profile-username"
              ref={nameInputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              readOnly={!nameEditable}
              disabled={saving}
              autoComplete="nickname"
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              aria-readonly={!nameEditable}
            />
            <button
              type="button"
              className="editNameBtn"
              onClick={handleEnableNameEdit}
              disabled={saving || nameEditable}
              aria-label={
                nameEditable ? "Display name is editable" : "Edit display name"
              }
            >
              {nameEditable ? "Editing" : "Edit"}
            </button>
          </div>

          <p className="emailHint">{currentUser?.email}</p>

          <div className="actions">
            <button
              type="button"
              className="cancelBtn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="saveBtn" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
};

export default EditProfile;
