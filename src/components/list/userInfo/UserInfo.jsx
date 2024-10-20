import React from "react";
import "./UserInfo.css";

const UserInfo = () => {
  return (
    <div className="userInfo">
      {/* ----- USER INFO ----- */}
      <div className="user">
        <img src="./avatar.png" alt="" />
        <h3 className="">Safina Promity</h3>
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
