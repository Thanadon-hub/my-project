// components/Navbar.jsx
import React from "react";

export default function Navbar({ user, userRole, onLogout }) {
  return (
    <div style={styles.navbar}>
      <div style={styles.left}>
        <h1 style={styles.title}>Electrostatic Dashboard</h1>
      </div>
      <div style={styles.right}>
        {user ? (
          <>
            <div style={styles.userInfo}>
              <span style={styles.roleBadge}>{userRole || "member"}</span>
              <span style={styles.email}>{user.email}</span>
            </div>
            <button onClick={onLogout} style={styles.logoutButton}>
              ออกจากระบบ
            </button>
          </>
        ) : (
          <button
            onClick={() => window.location.href = '/login'}
            style={styles.loginButton}
          >
            เข้าสู่ระบบ
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  navbar: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    backgroundColor: "#004d99",
    padding: "10px 20px",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxSizing: "border-box",
    zIndex: 1000,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  title: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: "600",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    fontSize: "12px",
    lineHeight: 1.1,
  },
  email: {
    opacity: 0.9,
  },
  roleBadge: {
    backgroundColor: "#28a745",
    padding: "2px 6px",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "10px",
    marginBottom: "2px",
    display: "inline-block",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  logoutButton: {
    backgroundColor: "#ffffff",
    color: "#004d99",
    border: "none",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: "600",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "filter .2s",
  },
  loginButton: {
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: "600",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "filter .2s",
  }
};
