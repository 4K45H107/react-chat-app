import React, { useState } from "react";
import "./Login.css";
import { toast } from "react-toastify";

const Login = () => {
  const [avatar, setAvatar] = useState({ file: null, url: "" });

  const handleAvatar = (e) => {
    if (!e.target.files.length) return;

    let file = e.target.files[0];
    setAvatar({ file, url: URL.createObjectURL(file) });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    toast.success("Account created successfully!");
  };

  return (
    <div className="login">
      <div className="item">
        <h2>Welcome Back!</h2>
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Email" className="email" />
          <input type="text" placeholder="Password" className="password" />
          <button>Sign In</button>
        </form>
      </div>

      <div className="seperator"></div>

      <div className="item">
        <h2>Create an Account</h2>
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Name" className="name" />
          <input type="text" placeholder="Email" className="email" />
          <input type="text" placeholder="Password" className="password" />
          <label htmlFor="file">
            <img src={avatar.file ? avatar.url : "./avatar.png"} alt="" />
            Upload an Image
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleAvatar}
          />
          <button>Sign up</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
