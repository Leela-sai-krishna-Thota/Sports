/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isOrganizer: boolean;
  isPlayer: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (firebaseUser: FirebaseUser, defaultName?: string) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Automatically provision a default Player profile matching runtime details if it is the first login
        const defaultRole: UserRole = (firebaseUser.email === 'thotaleelasaikrishna@gmail.com' || firebaseUser.email?.toLowerCase().includes('admin')) ? 'Admin' : 'Player';
        const newProfile: UserProfile = {
          userId: firebaseUser.uid,
          name: defaultName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Athlete',
          email: firebaseUser.email || '',
          profileImage: firebaseUser.photoURL || '',
          role: defaultRole,
          createdAt: new Date().toISOString()
        };
        
        // Write to Firestore and handle errors strictly
        try {
          await setDoc(userDocRef, {
            ...newProfile,
            createdAt: serverTimestamp() // Firestore rules strict temporal stamp check
          });
          setProfile(newProfile);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchOrCreateProfile(user);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await fetchOrCreateProfile(result.user);
    } catch (err) {
      console.error('Google Sign In Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(result.user, name);
    } catch (err) {
      console.error('Email Sign Up Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(result.user);
    } catch (err) {
      console.error('Email Sign In Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setProfile(null);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    logout,
    isAdmin: profile?.role === 'Admin',
    isOrganizer: profile?.role === 'Organizer' || profile?.role === 'Admin',
    isPlayer: profile?.role === 'Player',
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
