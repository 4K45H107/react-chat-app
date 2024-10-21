import React from "react";
import List from "./components/List/List";
import Chat from "./components/Chat/Chat";
import Details from "./components/Details/Details";
import Login from "./components/login/Login";

const App = () => {
  const user = false;

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
    </div>
  );
};

export default App;
