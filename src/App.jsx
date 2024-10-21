import React from "react";
import List from "./components/List/List";
import Chat from "./components/Chat/Chat";
import Details from "./components/Details/Details";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";

const App = () => {
  const user = true;

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
