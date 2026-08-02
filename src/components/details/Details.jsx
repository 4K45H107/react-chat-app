import React from "react";
import "./details.css";
import { auth } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";

const Details = () => {
  const { user } = useChatStore();

  const handLogOut = async () => {
    // Sign out the user
    await auth.signOut();
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

        {/* ----- BLOCK ----- */}
        <button className="btn-blk">Block User</button>
        {/* ----- LOGOUT ----- */}
        <button className="btn-lgout" onClick={handLogOut}>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Details;
