import React, { useEffect } from "react";
import List from "./components/List/List";
import Chat from "./components/Chat/Chat";
import Details from "./components/Details/Details";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";

const App = () => {
  // Get the current user from zustand userStore
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();

  // Fetch the user info when the app loads
  useEffect(() => {
    // Listen for auth state changes
    const unSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid);
    });

    // Unsubscribe from the listener when the component unmounts
    return () => unSub();
  }, [fetchUserInfo]);

  if (isLoading) return <div className="loading">Loading...</div>;

  return (
    <div className="container">
      {!currentUser ? (
        <Login />
      ) : (
        <>
          <List />
          <Chat />
          <Details />
        </>
      )}

      <Notification />
    </div>
  );
};

export default App;
