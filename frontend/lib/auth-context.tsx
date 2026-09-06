'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { apiClient } from './api-client';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  token: null,
  login: async () => {
    throw new Error('AuthProvider not mounted');
  },
  loginWithGoogle: async () => {
    throw new Error('AuthProvider not mounted');
  },
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // onIdTokenChanged handles initial auth state, user sign-in/out, and token refresh
    const unsubscribe = onIdTokenChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const idToken = await firebaseUser.getIdToken();
            apiClient.setAuthToken(idToken);
            setUser(firebaseUser);
            setToken(idToken);
          } catch (err) {
            console.error('Failed to obtain Firebase ID token:', err);
            apiClient.setAuthToken(null);
            setUser(null);
            setToken(null);
          }
        } else {
          apiClient.setAuthToken(null);
          setUser(null);
          setToken(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Firebase Auth state change error:', error);
        apiClient.setAuthToken(null);
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();
    apiClient.setAuthToken(idToken);
    setUser(credential.user);
    setToken(idToken);
    return credential;
  };

  const loginWithGoogle = async (): Promise<UserCredential> => {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();
    apiClient.setAuthToken(idToken);
    setUser(credential.user);
    setToken(idToken);
    return credential;
  };

  const logout = async (): Promise<void> => {
    await firebaseSignOut(auth);
    apiClient.setAuthToken(null);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        token,
        login,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
