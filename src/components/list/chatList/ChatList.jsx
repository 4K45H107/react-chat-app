import React, { useState } from "react";
import "./ChatList.css";

const ChatList = () => {
  const [addMore, setAddMore] = React.useState(false);

  return (
    <div className="chatList">
      {/* ------ SEARCH ------ */}
      <div className="search">
        <div className="searchBar">
          <img src="./search.png" alt="" />
          <input type="text" placeholder="Search" />
        </div>
        <img
          src={!addMore ? "./plus.png" : "./minus.png"}
          alt=""
          className="add"
          onClick={() => setAddMore((prev) => !prev)}
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
    </div>
  );
};

export default ChatList;
