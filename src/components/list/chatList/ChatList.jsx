import React, { useState } from "react";
import "./ChatList.css";
import AddUser from "./addUser/AddUser";

const ChatList = () => {
  const [addMode, setAddMode] = useState(false);

  return (
    <div className="chatList">
      {/* ------ SEARCH ------ */}
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input type="text" placeholder="Search" />
        </div>
        <img
          src={!addMode ? "./plus.png" : "./minus.png"}
          alt=""
          className="add"
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>

      {/* ------ ITEMS ------ */}
      <div className="item">
        <img src="./avatar.png" alt="" />
        <div className="texts">
          <span>Safina Promity</span>
          <p>Hello</p>
        </div>
      </div>

      <div className="item">
        <img src="./avatar.png" alt="" />
        <div className="texts">
          <span>Safina Promity</span>
          <p>Hello</p>
        </div>
      </div>
      {addMode && <AddUser />}
    </div>
  );
};

export default ChatList;
