// routes/AdminRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { user, role } = useAuth();
  return user && role === "admin" ? children : <Navigate to="/" />;
}