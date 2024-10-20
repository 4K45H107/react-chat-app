import React, { useState } from "react";
import "./Chat.css";
import EmojiPicker from "emoji-picker-react";

const Chat = () => {
  const [openEmoji, setOpenEmoji] = useState(false);
  const [text, setText] = useState("");

  const handleEmoji = (e) => {
    let newText = text + e.emoji;
    setText(newText);
    setOpenEmoji(false);
  };

  return (
    <div className="chat">
      {/* ------ TOP ------ */}
      <div className="top">
        {/* ------ USER INFO ------ */}
        <div className="user">
          <img src="./avatar.png" alt="" />
          <div className="texts">
            <span>Safina Promity</span>
            <p>I am safina</p>
          </div>
        </div>
        {/* ---- ICONS ---- */}
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          <img src="./info.png" alt="" />
        </div>
      </div>

      {/* ------ CENTER ------ */}
      <div className="center">
        {/* ----- OWN MESSAGE ----- */}
        <div className="message own">
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>

        {/* ----- OTHER MESSAGE ----- */}
        <div className="message">
          <img src="./avatar.png" alt="" />
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>

            <span>1 min ago</span>
          </div>
        </div>

        <div className="message own">
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>

        <div className="message">
          <img src="./avatar.png" alt="" />
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>

        <div className="message own">
          <div className="texts">
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>

        <div className="message">
          <img src="./avatar.png" alt="" />
          <div className="texts">
            <img src="https://picsum.photos/200/300" alt="" />
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>

        <div className="message own">
          <div className="texts">
            <img src="https://picsum.photos/200/300" alt="" />
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Numquam
              facere in illo recusandae deleniti magnam ipsam. Cum illum animi,
              atque omnis, enim iusto facere perspiciatis ratione saepe numquam
              sed blanditiis! Minus est ut at fugiat.
            </p>
            <span>1 min ago</span>
          </div>
        </div>
      </div>

      {/* ------ BOTTOM ------ */}
      <div className="bottom">
        <div className="icons">
          <img src="./img.png" alt="" />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          value={text || ""}
          placeholder="Type a message..."
          onChange={(e) => setText(e.target.value)}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt=""
            onClick={() => setOpenEmoji((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={openEmoji} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button className="sendButton">Send</button>
      </div>
    </div>
  );
};

export default Chat;
