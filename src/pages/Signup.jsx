// pages/Signup.jsx
import React from "react";
import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Signup.css";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (password.length < 6) {
      alert("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    
    try {
      // สร้าง user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // บันทึกข้อมูล user ใน Firestore พร้อม role
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: name || "ผู้ใช้งาน",
        role: "user", // สมาชิกใหม่จะเป็น user ทั้งหมด
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      console.log("สมัครสมาชิกสำเร็จ: ", user.email);
      navigate("/");
      
    } catch (error) {
      console.error("Signup error:", error);
      
      // แสดงข้อความผิดพลาดเป็นภาษาไทย
      let errorMessage = "การสมัครสมาชิกไม่สำเร็จ";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
          break;
        case 'auth/invalid-email':
          errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
          break;
        case 'auth/weak-password':
          errorMessage = "รหัสผ่านไม่แข็งแรงพอ";
          break;
        default:
          errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <form onSubmit={handleSignup} className="signup-form">
        <h2 className="signup-title">สมัครสมาชิก</h2>
        
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล (ไม่บังคับ)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="signup-input"
        />
        
        <input
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="signup-input"
          required
        />
        
        <input
          type="password"
          placeholder="รหัสผ่าน (ขั้นต่ำ 6 ตัว)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="signup-input"
          required
          minLength={6}
        />
        
        <button 
          type="submit" 
          className="signup-button"
          disabled={loading}
        >
          {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
        </button>
        
        <p className="signup-footer">
          มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a>
        </p>
        
        <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
          💡 หมายเหตุ: สมาชิกใหม่จะมีสิทธิ์เป็น "ผู้ใช้งานทั่วไป" <br/>
          สามารถดูข้อมูลและประวัติได้ แต่ไม่สามารถแก้ไขได้
        </div>
      </form>
    </div>
  );
}