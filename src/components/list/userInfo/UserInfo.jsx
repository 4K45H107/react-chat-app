import React, { useState } from "react";
import "./UserInfo.css";
import { auth } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";
import EditProfile from "./EditProfile";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const [editOpen, setEditOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
  };

  return (
    <div className="userInfo">
      {/* ----- USER INFO ----- */}
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

      {/* ----- ACTIONS ----- */}
      <div className="actions">
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
