import React, { useEffect } from "react";
import List from "./components/list/List";
import Chat from "./components/chat/Chat";
import Details from "./components/details/Details";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";

const App = () => {
  // Get the current user from zustand userStore
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();
  const { chatId, showDetails } = useChatStore();

  // Fetch the user info when the app loads
  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Drop stale chatId/user from the previous session
        useChatStore.getState().resetChat();
      }
      fetchUserInfo(user?.uid);
    });

    // Unsubscribe from the listener when the component unmounts
    return () => unSub();
  }, [fetchUserInfo]);

  if (isLoading) return <div className="loading">Loading...</div>;

  return (
    <div className={`container${chatId ? " chat-open" : ""}`}>
      {!currentUser ? (
        <Login />
      ) : (
        <>
          <List />
          {chatId && <Chat />}
          {chatId && showDetails && <Details />}
        </>
      )}

      <Notification />
    </div>
  );
};

export default App;
