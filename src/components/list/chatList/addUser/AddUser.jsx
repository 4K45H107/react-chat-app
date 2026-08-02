import React, { useState } from "react";
import "./Adduser.css";
import { toast } from "react-toastify";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";

const AddUser = () => {
  const [user, setUser] = useState(null);
  const { currentUser } = useUserStore();

  const handleSearch = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const username = formData.get("username");

    try {
      const userRef = collection(db, "users");

      // create a query against a collection
      const q = query(userRef, where("username", "==", username));
      const querySnapShot = await getDocs(q);

      if (!querySnapShot.empty) {
        setUser(querySnapShot.docs[0].data());
      } else {
        console.warn("[AddUser] No user found for username:", username);
        toast.warn(`No user found with username "${username}"`);
      }
    } catch (error) {
      console.error(
        "[AddUser] User search failed:",
        error.code,
        error.message,
        error
      );
      toast.error("User search failed. Please try again.");
    }
  };

  const handleAdd = async () => {
    // Guard: "+" must not run until a user has been found via search
    if (!user?.id) return;

    const chatRef = collection(db, "chats");
    const userChatRef = collection(db, "userChats");

    try {
      // New chat Id to access the chat document
      const newChatRef = doc(chatRef);
      // Add chat to userChats
      await setDoc(newChatRef, {
        creterdAt: serverTimestamp(),
        messages: [],
      });

      // Add chat to userChats
      await updateDoc(doc(userChatRef, user.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          receiverId: currentUser.id,
          lastMessage: "",
          updatedAt: Date.now(),
        }),
      });

      // Add chat to currentUser
      await updateDoc(doc(userChatRef, currentUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          receiverId: user.id,
          lastMessage: "",
          updatedAt: Date.now(),
        }),
      });

      toast.success("Chat created!");
      setUser(null);
    } catch (error) {
      console.error(
        "[AddUser] Failed to create chat:",
        error.code,
        error.message,
        error
      );
      toast.error("Failed to create chat. Please try again.");
    }
  };

  return (
    <div className="addUser">
      <form onSubmit={handleSearch}>
        <input type="text" placeholder="Username" name="username" />
        <button>Search</button>
      </form>

      {user && (
        <div className="user">
          <div className="details">
            <img src={user.avatar || "./avatar.png"} alt="" />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}>+</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;
