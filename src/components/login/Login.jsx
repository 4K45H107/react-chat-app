import React, { useState } from "react";
import "./Login.css";
import { toast } from "react-toastify";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import upload from "../../lib/upload";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 3;

const authErrorMessage = (error) => {
  switch (error.code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
};

const Login = () => {
  const [mode, setMode] = useState("signin");
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

    const formData = new FormData(e.target);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      toast.warn("Email and password are required.");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      toast.warn("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error(
        "[Login] Sign in failed:",
        error.code,
        error.message,
        error
      );
      toast.error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !email || !password) {
      toast.warn("Username, email, and password are required.");
      return;
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      toast.warn(
        `Username must be at least ${MIN_USERNAME_LENGTH} characters.`
      );
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      toast.warn("Please enter a valid email address.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.warn(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    setLoading(true);

    try {
      // Auth is required to read users (see firestore.rules), so create the
      // Auth account first, then reject duplicate usernames and roll back.
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const usernameSnap = await getDocs(
        query(collection(db, "users"), where("username", "==", username))
      );

      if (!usernameSnap.empty) {
        await deleteUser(cred.user);
        toast.warn("That username is already taken. Please choose another.");
        return;
      }

      const imageUrl = await upload(avatar.file);

      await setDoc(doc(db, "users", cred.user.uid), {
        username,
        email,
        id: cred.user.uid,
        blocked: [],
        avatar: imageUrl || "",
      });

      await setDoc(doc(db, "userChats", cred.user.uid), {
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
      toast.error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === "signin";

  return (
    <div className="login">
      <div className="item">
        <h2>{isSignIn ? "Welcome Back!" : "Create an Account"}</h2>

        {isSignIn ? (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              className="email"
              name="email"
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              className="password"
              name="password"
              autoComplete="current-password"
            />
            <button disabled={loading}>
              {loading ? "Loading..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Username"
              className="username"
              name="username"
              autoComplete="username"
            />
            <input
              type="email"
              placeholder="Email"
              className="email"
              name="email"
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              className="password"
              name="password"
              autoComplete="new-password"
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
              {loading ? "Loading..." : "Sign Up"}
            </button>
          </form>
        )}

        <p className="switch">
          {isSignIn ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="switch-btn"
                onClick={() => setMode("signup")}
                disabled={loading}
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="switch-btn"
                onClick={() => setMode("signin")}
                disabled={loading}
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Login;
