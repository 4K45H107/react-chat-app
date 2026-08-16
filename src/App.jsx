import React, { useEffect } from "react";
import List from "./components/list/List";
import Chat from "./components/chat/Chat";
import Details from "./components/details/Details";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import CallOverlay from "./components/call/CallOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";
import { bumpLastActive } from "./lib/presence";

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

  // Heartbeat presence while signed in
  useEffect(() => {
    if (!currentUser?.id) return;

    const tick = () => {
      bumpLastActive(currentUser.id).catch((error) => {
        console.warn(
          "[App] Failed to bump lastActive:",
          error.code,
          error.message
        );
      });
    };

    tick();
    const intervalId = setInterval(tick, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentUser?.id]);

  if (isLoading) return <div className="loading">Loading...</div>;

  return (
    <div className={`container${chatId ? " chat-open" : ""}`}>
      {!currentUser ? (
        <Login />
      ) : (
        <ErrorBoundary>
          <List />
          {chatId && <Chat />}
          {chatId && showDetails && <Details />}
          <CallOverlay />
        </ErrorBoundary>
      )}

      <Notification />
    </div>
  );
};

export default App;
