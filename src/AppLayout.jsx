// AppLayout.jsx
import React from "react";
import Navbar from "./components/Navbar";

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <div className="content">
        {children}
      </div>
    </div>
  );
}
