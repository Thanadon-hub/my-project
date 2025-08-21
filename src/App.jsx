import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History"; // อย่าลืมนำเข้ามา
import PrivateRoute from "./routes/PrivateRoute";
import AdminRoute from "./routes/AdminRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* ให้หน้า Dashboard เปิดได้เลย */}
      <Route path="/" element={<Dashboard />} />

      {/* เพิ่ม route สำหรับ history */}
      <Route path="/history/:macAddr" element={<History />} /> {/* << เพิ่มอันนี้ */}

      {/* Admin route */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Dashboard />
          </AdminRoute>
        }
      />
    </Routes>
  );
}
