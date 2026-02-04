import React from "react";
import "./details.css";
import { auth } from "../../lib/firebase";

const Details = () => {
  const handLogOut = async () => {
    // Sign out the user
    await auth.signOut();
  };

  return (
    <div className="details">
      {/* ----- USER ----- */}
      <div className="user">
        <img src="./avatar.png" alt="" />
        <h2>Safina Promity</h2>
        <p>Lorem ipsum dolor</p>
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

          {/* ----- PHOTOS ----- */}
          <div className="photos">
            <div className="photoItem">
              <div className="photoDetail">
                <img src="https://picsum.photos/200/300" alt="" />
                <span>photo_cse_fest</span>
                <img src="./download.png" alt="" className="download" />
              </div>
            </div>
            <div className="photoItem">
              <div className="photoDetail">
                <img src="https://picsum.photos/200/300" alt="" />
                <span>photo_cse_fest</span>
                <img src="./download.png" alt="" className="download" />
              </div>
            </div>
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
