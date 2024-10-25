import React, { useEffect } from "react";
import List from "./components/List/List";
import Chat from "./components/Chat/Chat";
import Details from "./components/Details/Details";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";

const App = () => {
  const user = false;

  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log(user);
      } else {
        console.log("no user");
      }
    });

    return () => unSub();
  }, []);

  return (
    <div className="container">
      {!user ? (
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
