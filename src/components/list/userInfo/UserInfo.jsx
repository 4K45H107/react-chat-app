import React, { useState } from "react";
import "./UserInfo.css";
import { toast } from "react-toastify";
import { auth } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";
import { cycleTheme } from "../../../lib/theme";
import EditProfile from "./EditProfile";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const [editOpen, setEditOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
  };

  const handleThemeToggle = () => {
    const next = cycleTheme();
    toast.info(next === "light" ? "Light theme" : "Dark theme", {
      autoClose: 1200,
    });
  };

  return (
    <div className="userInfo">
      <div className="user">
        <button
          type="button"
          className="avatarBtn"
          onClick={() => setEditOpen(true)}
          aria-label="Edit profile"
          title="Edit profile"
        >
          <img
            src={currentUser.avatar || "./avatar.png"}
            alt=""
            aria-hidden="true"
          />
        </button>
        <h3>{currentUser.username}</h3>
      </div>

      <div className="actions">
        <button
          type="button"
          className="themeBtn"
          onClick={handleThemeToggle}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <img src="./theme.png" alt="" aria-hidden="true" />
        </button>
        <button
          className="btn-lgout"
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
        >
          Log Out
        </button>
      </div>

      {editOpen && <EditProfile onClose={() => setEditOpen(false)} />}
    </div>
  );
};

export default UserInfo;
