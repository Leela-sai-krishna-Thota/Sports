/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Bell, LogIn, LogOut, ShieldAlert, User, Check, Trash, Menu, X, Compass, LayoutDashboard, ShieldEllipsis } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SystemNotification } from '../types';

interface NavbarProps {
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
}

export default function Navbar({ currentTab, setCurrentTab }: NavbarProps) {
  const { user, profile, signInWithGoogle, logout, isAdmin, isOrganizer, refreshProfile, signInWithEmail, signUpWithEmail } = useAuth();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [loggingIn, setLoggingIn] = useState<'Admin' | 'Player' | null>(null);
  const [authErrorNotice, setAuthErrorNotice] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleQuickLogin = async (targetRole: 'Admin' | 'Player') => {
    setLoggingIn(targetRole);
    setAuthErrorNotice(null);
    const email = targetRole === 'Admin' ? 'admin@sportflow.com' : 'player@sportflow.com';
    const password = 'password123';
    const name = targetRole === 'Admin' ? 'Director Admin' : 'Pro League Player';
    
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      console.log('SignIn failed/disabled, checking for operation block...', err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setAuthErrorNotice(`Notice: Email auth is not enabled in your Firebase console. Please sign in via Google SSO. Once signed in, you can toggle between Admin & Player roles instantly using the 'Switch Role' button in the toolbar!`);
        try {
          await signInWithGoogle();
        } catch (ssoErr) {
          console.warn('SSO login canceled:', ssoErr);
        }
      } else {
        try {
          await signUpWithEmail(email, password, name);
        } catch (signUpErr: any) {
          if (signUpErr.code === 'auth/operation-not-allowed' || signUpErr.message?.includes('operation-not-allowed')) {
            setAuthErrorNotice(`Notice: Email auth is not enabled in your Firebase console. Please sign in via Google SSO. Once signed in, you can toggle between Admin & Player roles instantly using the 'Switch Role' button in the toolbar!`);
            try {
              await signInWithGoogle();
            } catch (ssoErr) {
              console.warn('SSO login canceled:', ssoErr);
            }
          } else {
            console.error('Preset registration failed:', signUpErr);
          }
        }
      }
    } finally {
      setLoggingIn(null);
    }
  };

  const toggleSandboxRole = async () => {
    if (!user || !profile) return;
    setSwitchingRole(true);
    const targetRole = profile.role === 'Admin' ? 'Player' : 'Admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: targetRole });
      await refreshProfile();
    } catch (err) {
      console.error('Failed to change sandbox role:', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  // Load user alerts in real-time
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: SystemNotification[] = [];
      snapshot.forEach((d) => {
        notifs.push(d.data() as SystemNotification);
      });
      // Sort newest first
      notifs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const clearAllNotifications = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'notifications/bulk');
    }
  };

  const navigateTo = (tab: string) => {
    if (setCurrentTab) {
      setCurrentTab(tab);
    }
    setShowMobileMenu(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between text-white shadow-xl" id="app-navbar">
      {/* Brand & Mobile Hamburger Toggle */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-slate-805 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white italic shrink-0">
          S
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-white">
            SPORT<span className="text-blue-500">FLOW</span> PRO
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 tracking-widest align-middle">
            Vite Core
          </span>
        </div>
      </div>

      {/* Action Items */}
      <div className="flex items-center gap-4">
        {user ? (
          <>
            {/* Sandbox Role Switcher Widget */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-full p-1 pl-3 text-xs shadow-md">
              {isAdmin ? (
                <span className="flex items-center gap-1.5 text-red-405 text-red-400 font-extrabold select-none">
                  <ShieldAlert className="w-3.5 h-3.5" /> ADMIN
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-blue-450 text-blue-400 font-extrabold select-none">
                  <User className="w-3.5 h-3.5" /> PLAYER
                </span>
              )}
              
              <button
                onClick={toggleSandboxRole}
                disabled={switchingRole}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-full transition-all cursor-pointer shadow"
                title="Switch test role"
              >
                {switchingRole ? '...' : 'Switch Role'}
              </button>
            </div>

            {/* Notification bell menu */}
            <div className="relative">
              <button
                id="btn-notif"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                 className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <Bell className="w-5.5 h-5.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-blue-600 text-[10px] font-black rounded-full text-white border-2 border-slate-900 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Overlay Dropdown */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-slate-200 z-50 select-none animate-[slide-in_150ms_ease-out]">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-700 mb-2">
                    <h4 className="font-extrabold text-sm text-slate-100">Live Notifications</h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 py-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-2.5 rounded-lg border text-xs transition-all ${
                            notif.read
                              ? 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                              : 'bg-slate-700/50 border-blue-500/30 text-slate-100 font-medium'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold underline text-blue-400">{notif.title}</span>
                            {!notif.read && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="p-0.5 bg-blue-600/20 hover:bg-blue-600/40 rounded text-blue-300 cursor-pointer"
                                title="Mark read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="mt-1 leading-relaxed text-[11px]">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile pill layout */}
            <div className="flex items-center gap-2.5 bg-slate-800 pl-2.5 pr-4 py-1.5 rounded-full border border-slate-700/80 shadow-inner">
              {profile?.profileImage ? (
                <img
                  referrerPolicy="no-referrer"
                  src={profile.profileImage}
                  alt={profile.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-600"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-100 truncate max-w-[100px]">{profile?.name}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {profile?.role || 'User'}
                </span>
              </div>
            </div>

            {/* Sign out */}
            <button
              id="btn-logout"
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
         ) : (
          <div className="relative flex flex-col items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-login-admin"
                onClick={() => handleQuickLogin('Admin')}
                disabled={loggingIn !== null}
                className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-650 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {loggingIn === 'Admin' ? 'Entering...' : 'Admin Login'}
              </button>
              <button
                id="btn-login-player"
                onClick={() => handleQuickLogin('Player')}
                disabled={loggingIn !== null}
                className="flex items-center gap-1.5 bg-blue-950/40 hover:bg-blue-650 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                <User className="w-3.5 h-3.5" />
                {loggingIn === 'Player' ? 'Completing...' : 'Player Login'}
              </button>
              <button
                id="btn-login-sso"
                onClick={signInWithGoogle}
                disabled={loggingIn !== null}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                title="Sign in with Google Account"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" /> SSO
              </button>
            </div>
            {authErrorNotice && (
              <div className="absolute top-12 right-0 w-80 bg-slate-900 border border-amber-500/30 text-amber-300 p-3 rounded-lg text-[10px] leading-relaxed shadow-xl z-50 mt-1 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                  <span className="font-extrabold uppercase tracking-wide">⚠️ CONFIGURATION NOTICE</span>
                  <button 
                    onClick={() => setAuthErrorNotice(null)} 
                    className="text-slate-400 hover:text-white font-bold px-1 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p>{authErrorNotice}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Drawer Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMobileMenu(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-72 max-w-xs bg-slate-900 border-r border-slate-800 h-full p-6 animate-in slide-in-from-left duration-200 shadow-2xl z-50 text-white">
            {/* Header / Dismiss */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xs italic">
                  S
                </div>
                <span className="font-extrabold tracking-tight text-white uppercase text-sm">Navigation</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-805 transition-colors cursor-pointer"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Lists */}
            <div className="flex-1 space-y-2 overflow-y-auto">
              {/* Explore Feed */}
              <button
                onClick={() => navigateTo('feed')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                  currentTab === 'feed'
                    ? 'bg-blue-600 font-extrabold text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Compass className="w-4 h-4 text-orange-500" />
                Explore Arena
              </button>

              {/* Tournaments List */}
              <button
                onClick={() => navigateTo('tournaments')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                  currentTab === 'tournaments'
                    ? 'bg-blue-600 font-extrabold text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4 text-orange-500" />
                Tournament Arenas
              </button>

              {/* User Dashboard Lounge */}
              {user && (
                <button
                  onClick={() => navigateTo('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                    currentTab === 'dashboard'
                      ? 'bg-blue-600 font-extrabold text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-orange-500" />
                  Player Lounge
                </button>
              )}

              {/* Administrative console */}
              {user && (isOrganizer || isAdmin) && (
                <button
                  onClick={() => navigateTo('admin')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs uppercase font-extrabold transition-all cursor-pointer ${
                    currentTab === 'admin'
                      ? 'bg-blue-600 font-extrabold text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ShieldEllipsis className="w-4 h-4 text-orange-500" />
                  Management Deck
                </button>
              )}
            </div>

            {/* Live Role Indicators inside Mobile Drawer */}
            <div className="border-t border-slate-800 pt-6 mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Current Identity:</span>
                {isAdmin ? (
                  <span className="text-red-405 text-red-400 text-xs font-black uppercase flex items-center gap-1 select-none">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin
                  </span>
                ) : (
                  <span className="text-blue-450 text-blue-400 text-xs font-black uppercase flex items-center gap-1 select-none">
                    <User className="w-3.5 h-3.5" /> Player
                  </span>
                )}
              </div>
              <button
                onClick={toggleSandboxRole}
                disabled={switchingRole}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-205 border border-slate-700 font-bold py-2 px-3 rounded-xl text-[11px] uppercase transition-all select-none cursor-pointer"
              >
                {switchingRole ? 'Switching...' : 'Toggle Test Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
