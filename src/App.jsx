import { Suspense, lazy, useEffect } from "react";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";

// The signed-in app (and Firestore with it) is a separate chunk. It starts
// downloading as soon as the login screen is idle, so it's usually ready by
// the time someone has typed their password.
const loadSignedInApp = () => import("./SignedInApp");
const SignedInApp = lazy(loadSignedInApp);

const whenIdle = (callback) =>
  "requestIdleCallback" in window
    ? window.requestIdleCallback(callback, { timeout: 2000 })
    : setTimeout(callback, 300);

const Loading = () => <div className="loading">Loading...</div>;

const App = () => {
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();
  const { chatId } = useChatStore();

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

  // Prefetch the signed-in chunk while the login screen is showing
  useEffect(() => {
    if (isLoading || currentUser) return;
    whenIdle(() => {
      loadSignedInApp().catch(() => {});
    });
  }, [isLoading, currentUser]);

  if (isLoading) return <Loading />;

  return (
    <div className={`container${chatId ? " chat-open" : ""}`}>
      {!currentUser ? (
        <Login />
      ) : (
        <Suspense fallback={<Loading />}>
          <SignedInApp />
        </Suspense>
      )}

      <Notification />
    </div>
  );
};

export default App;
