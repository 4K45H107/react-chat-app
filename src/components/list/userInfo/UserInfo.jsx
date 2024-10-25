import React from "react";
import "./UserInfo.css";
import { useUserStore } from "../../../lib/userStore";

const UserInfo = () => {
  const { currentUser } = useUserStore();

  return (
    <div className="userInfo">
      {/* ----- USER INFO ----- */}
      <div className="user">
        <img src={currentUser.avatar || "./avatar.png"} alt="" />
        <h3 className="">{currentUser.username}</h3>
      </div>

      {/* ----- ICONS ----- */}
      <div className="icons">
        <img src="./more.png" alt="" />
        <img src="./video.png" alt="" />
        <img src="./edit.png" alt="" />
      </div>
    </div>
  );
};

export default UserInfo;
