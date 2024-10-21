import React from "react";
import "./AddUser.css";

const AddUser = () => {
  return (
    <div className="addUser">
      <form>
        <input type="text" placeholder="Username" name="username" />
        <button>Search</button>
      </form>

      <div className="user">
        <div className="details">
          <img src="./avatar.png" alt="" />
          <span>Safina Promity</span>
        </div>
        <button>+</button>
      </div>
    </div>
  );
};

export default AddUser;
