import React from "react";
import List from "./components/List/List";
import Chat from "./components/Chat/Chat";
import Details from "./components/Details/Details";

const App = () => {
  return (
    <div className="container">
      <List />
      <Chat />
      <Details />
    </div>
  );
};

export default App;
