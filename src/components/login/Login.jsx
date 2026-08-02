import React, { useState } from "react";
import "./Login.css";
import { toast } from "react-toastify";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import upload from "../../lib/upload";

const Login = () => {
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);

  const handleAvatar = (e) => {
    if (!e.target.files.length) return;

    const file = e.target.files[0];
    setAvatar((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);

    try {
      // Sign in the user
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(
        "[Login] Sign in failed:",
        error.code,
        error.message,
        error
      );
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    // Prevent the form from submitting
    e.preventDefault();
    setLoading(true);

    // Get the form data
    const formData = new FormData(e.target);
    const { username, email, password } = Object.fromEntries(formData);

    try {
      // Create a new user
      const user = await createUserWithEmailAndPassword(auth, email, password);

      // Upload the avatar in firebase storage - using middleware upload.js
      const imageUrl = await upload(avatar.file);

      // Create a new user in firestore user collection
      await setDoc(doc(db, "users", user.user.uid), {
        username,
        email,
        id: user.user.uid,
        blocked: [],
        avatar: imageUrl || "",
      });

      // Create an empty chat list for the user
      await setDoc(doc(db, "userChats", user.user.uid), {
        chats: [],
      });
      toast.success("Account created successfully!");
    } catch (error) {
      console.error(
        "[Login] Registration failed:",
        error.code,
        error.message,
        error
      );
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="item">
        <h2>Welcome Back!</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Email"
            className="email"
            name="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="password"
            name="password"
          />
          <button disabled={loading}>
            {loading ? "Loading..." : "Sign In"}
          </button>
        </form>
      </div>

      <div className="separator"></div>

      <div className="item">
        <h2>Create an Account</h2>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Username"
            className="username"
            name="username"
          />
          <input
            type="text"
            placeholder="Email"
            className="email"
            name="email"
          />
          <input
            type="password"
            placeholder="Password"
            className="password"
            name="password"
          />
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
          <button disabled={loading}>
            {loading ? "Loading..." : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
