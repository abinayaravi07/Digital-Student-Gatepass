import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import api from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRoleState] = useState(
    () => sessionStorage.getItem('selectedRole') || null
  );

  const setSelectedRole = (role) => {
    if (role) {
      sessionStorage.setItem('selectedRole', role);
    } else {
      sessionStorage.removeItem('selectedRole');
    }
    setSelectedRoleState(role);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user && selectedRole) {
        try {
          const { user: userData } = await api.getMe();
          setDbUser(userData ? { ...userData, role: userData.role === 'classAdvisor' ? 'advisor' : userData.role } : null);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedRole]);

  const loginWithEmail = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  const registerWithEmail = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    setDbUser(null);
    setSelectedRole(null);
  };

  const refreshUser = async () => {
    const currentUser = auth.currentUser || firebaseUser;
    if (currentUser) {
      try {
        const { user: userData } = await api.getMe();
        const normalizedUser = userData ? { ...userData, role: userData.role === 'classAdvisor' ? 'advisor' : userData.role } : null;
        setDbUser(normalizedUser);
        return normalizedUser;
      } catch (error) {
        console.error('Error refreshing user:', error);
        return null;
      }
    }
    return null;
  };

  const value = {
    firebaseUser,
    dbUser,
    loading,
    selectedRole,
    setSelectedRole,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    refreshUser,
    isAuthenticated: !!firebaseUser && !!dbUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
