import { useEffect } from "react";
import List from "./components/list/List";
import Chat from "./components/chat/Chat";
import Details from "./components/details/Details";
import CallOverlay from "./components/call/CallOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";
import { bumpLastActive } from "./lib/presence";

/**
 * Everything behind sign-in. Loaded as its own chunk (with Firestore), so the
 * login screen doesn't wait for it.
 */
const SignedInApp = () => {
  const { currentUser } = useUserStore();
  const { chatId, showDetails } = useChatStore();

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

  return (
    <ErrorBoundary>
      <List />
      {chatId && <Chat />}
      {chatId && showDetails && <Details />}
      <CallOverlay />
    </ErrorBoundary>
  );
};

export default SignedInApp;
