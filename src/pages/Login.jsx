// pages/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // providers (เพิ่ม scope ที่จำเป็น)
  const google = new GoogleAuthProvider();
  const github = new GithubAuthProvider().addScope("user:email");

  useEffect(() => {
    // จดจำ session ไว้ในเบราว์เซอร์
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  useEffect(() => {
    // รับผลกลับจาก redirect (หลังล๊อกอินสำเร็จ)
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) navigate("/");
      } catch (err) {
        alert(mapAuthError(err));
      }
    })();
  }, [navigate]);

  const handleLoginEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (error) {
      alert(mapAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  // ---- ใช้ Redirect เสมอ เพื่อเลี่ยงปัญหา COOP/COEP ----
  const loginWithProvider = async (provider) => {
    setBusy(true);
    try {
      await signInWithRedirect(auth, provider);
      // กลับมาหน้านี้อีกครั้งหลัง provider เสร็จ → ไปต่อใน getRedirectResult()
    } catch (err) {
      alert(mapAuthError(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLoginEmail} className="login-form">
        <h2 className="login-title">เข้าสู่ระบบ</h2>

        <input
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="login-input"
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-input"
          autoComplete="current-password"
          required
        />

        <button type="submit" className="login-button" disabled={busy}>
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <div className="login-divider"><span>หรือ</span></div>

        <div className="social-buttons">
          <button
            type="button"
            className="btn-social btn-google"
            onClick={() => loginWithProvider(google)}
            disabled={busy}
          >
            เข้าสู่ระบบด้วย Google
          </button>

          <button
            type="button"
            className="btn-social btn-github"
            onClick={() => loginWithProvider(github)}
            disabled={busy}
          >
            เข้าสู่ระบบด้วย GitHub
          </button>
        </div>

        <p className="login-footer">
          ยังไม่มีบัญชี? <Link to="/signup">สมัครสมาชิก</Link><br />
          <Link to="/">กลับไปยังหน้าแรก</Link>
        </p>
      </form>
    </div>
  );
}

function mapAuthError(error) {
  const code = error?.code || "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "auth/user-not-found":
      return "ไม่พบบัญชีผู้ใช้";
    case "auth/account-exists-with-different-credential":
      return "อีเมลนี้เคยสมัครด้วยวิธีอื่นไว้แล้ว";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/popup-blocked":
      // จะไม่เจออีกเพราะเราไม่ใช้ popup แล้ว แต่เผื่อไว้
      return "การล็อกอินถูกยกเลิก";
    default:
      return `เกิดข้อผิดพลาด: ${error?.message || "ไม่ทราบสาเหตุ"}`;
  }
}
