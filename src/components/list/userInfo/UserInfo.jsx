import React from "react";
import "./UserInfo.css";
import { auth } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";

const UserInfo = () => {
  const { currentUser } = useUserStore();

  const handleLogout = async () => {
    await auth.signOut();
  };

  return (
    <div className="userInfo">
      {/* ----- USER INFO ----- */}
      <div className="user">
        <img src={currentUser.avatar || "./avatar.png"} alt="" />
        <h3>{currentUser.username}</h3>
      </div>

      {/* ----- ICONS ----- */}
      <div className="icons">
        <img src="./more.png" alt="" />
        <img src="./video.png" alt="" />
        <img src="./edit.png" alt="" />
        <button className="btn-lgout" type="button" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default UserInfo;
