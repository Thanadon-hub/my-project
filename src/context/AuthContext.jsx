// context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("guest"); // default เป็น guest
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const ref = doc(db, 'users', user.uid);
          const userDoc = await getDoc(ref);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(user);
            setUserRole(userData.role || 'user');
          } else {
            setUser(user);
            setUserRole('user'); // fallback ถ้าไม่มี document
          }
        } catch (error) {
          if (error.code === "permission-denied") {
            // กรณี rules ไม่ allow → fallback เป็น user เฉย ๆ ไม่ต้อง spam error
            console.warn(`No permission to read /users/${user.uid}, fallback to role=user`);
            setUser(user);
            setUserRole('user');
          } else {
            console.error('Error fetching user role:', error);
            setUser(user);
            setUserRole('user');
          }
        }
      } else {
        setUser(null);
        setUserRole('guest'); // guest mode
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isAdmin = userRole === 'admin';
  const isUser = userRole === 'user';
  const isLoggedIn = user !== null;

  const hasPermission = (permission) => {
    const permissions = {
      view_data: ['admin', 'user', 'guest'], // guest ก็อ่าน sensors ได้
      view_history: ['admin', 'user'],       // ต้องล็อกอิน
      add_sensor: ['admin'],
      delete_sensor: ['admin'],
      update_location: ['admin'],
    };

    const allowedRoles = permissions[permission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(userRole);
  };

  const value = {
    user,
    userRole,
    loading,
    isAdmin,
    isUser,
    isLoggedIn,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
