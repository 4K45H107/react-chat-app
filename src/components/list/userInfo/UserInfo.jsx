import React, { useState } from "react";
import "./UserInfo.css";
import { toast } from "react-toastify";
import { auth } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";
import { cycleTheme, getStoredTheme } from "../../../lib/theme";
import EditProfile from "./EditProfile";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
    </g>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 7 7 0 1 0 20.5 14.3z"
    />
  </svg>
);

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const [editOpen, setEditOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme);

  const handleLogout = async () => {
    await auth.signOut();
  };

  const handleThemeToggle = () => {
    const next = cycleTheme();
    setTheme(next);
    toast.info(next === "light" ? "Light theme" : "Dark theme", {
      autoClose: 1200,
    });
  };

  const switchingToLight = theme === "dark";

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
          aria-label={
            switchingToLight ? "Switch to light theme" : "Switch to dark theme"
          }
          title={switchingToLight ? "Light theme" : "Dark theme"}
        >
          {switchingToLight ? <SunIcon /> : <MoonIcon />}
          <span>{switchingToLight ? "Light" : "Dark"}</span>
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
