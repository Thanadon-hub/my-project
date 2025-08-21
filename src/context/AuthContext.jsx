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
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser(user);
            setUserRole(userData.role || 'user');
          } else {
            setUser(user);
            setUserRole('user');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUser(user);
          setUserRole('user');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isAdmin = () => userRole === 'admin';
  const isUser = () => userRole === 'user';
  const isLoggedIn = () => user !== null;

  const hasPermission = (permission) => {
    const permissions = {
      'view_data': ['admin', 'user', null], // รวมคนไม่ล็อกอินด้วย
      'view_history': ['admin', 'user'],    // ต้องล็อกอิน
      'add_sensor': ['admin'],               // admin เท่านั้น
      'delete_sensor': ['admin'],            // admin เท่านั้น
      'update_location': ['admin'],          // admin เท่านั้น
    };

    const allowedRoles = permissions[permission];
    if (!allowedRoles) return false;

    if (!user) {
      return allowedRoles.includes(null);
    }

    return allowedRoles.includes(userRole);
  };

  const value = {
    user,
    userRole,
    loading,
    isAdmin,
    isUser,
    isLoggedIn,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
export default AuthProvider;