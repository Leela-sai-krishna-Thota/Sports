/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import TournamentsPage from './pages/TournamentsPage';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Compass, Trophy, LayoutDashboard, ShieldEllipsis } from 'lucide-react';

function AppBody({ currentTab, setCurrentTab }: { currentTab: string; setCurrentTab: (tab: string) => void }) {
  const { user, isOrganizer, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-100">
      {/* Modern Sticky Navigation */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      {/* Master Flex container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Sidebar Menu */}
        <Sidebar currentTab={currentTab} onChangeTab={setCurrentTab} />

        {/* Core App Viewport */}
        <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 pb-24 md:pb-6 max-w-7xl mx-auto w-full">
          {currentTab === 'feed' && <Home onChangeTab={setCurrentTab} />}
          {currentTab === 'tournaments' && <TournamentsPage />}
          {currentTab === 'dashboard' && <Dashboard />}
          {currentTab === 'admin' && <AdminPanel />}
        </main>
      </div>

      {/* Sticky Bottom Mobile navigation bar - Touch friendly & elegant */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around text-slate-400">
        <button
          onClick={() => setCurrentTab('feed')}
          className={`flex-1 py-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
            currentTab === 'feed' ? 'text-blue-400 font-extrabold' : 'hover:text-slate-200'
          }`}
          style={{ minHeight: '48px' }}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] tracking-wide uppercase">Explore</span>
        </button>

        <button
          onClick={() => setCurrentTab('tournaments')}
          className={`flex-1 py-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
            currentTab === 'tournaments' ? 'text-blue-400 font-extrabold' : 'hover:text-slate-200'
          }`}
          style={{ minHeight: '48px' }}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] tracking-wide uppercase">Arenas</span>
        </button>

        {user && (
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
              currentTab === 'dashboard' ? 'text-blue-400 font-extrabold' : 'hover:text-slate-200'
            }`}
            style={{ minHeight: '48px' }}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] tracking-wide uppercase">Lounge</span>
          </button>
        )}

        {user && (isOrganizer || isAdmin) && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`flex-1 py-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
              currentTab === 'admin' ? 'text-blue-400 font-extrabold' : 'hover:text-slate-200'
            }`}
            style={{ minHeight: '48px' }}
          >
            <ShieldEllipsis className="w-5 h-5" />
            <span className="text-[10px] tracking-wide uppercase">Admin</span>
          </button>
        )}
      </nav>

      {/* System Footer Bar */}
      <footer className="h-10 bg-slate-950 border-t border-slate-900 px-8 flex items-center justify-between text-[10px] text-slate-600 shrink-0 font-mono tracking-widest hidden md:flex">
        <div className="flex gap-6">
          <span>Firebase Active</span>
          <span>Cloud Ingress</span>
          <span>Firestore Real-time Sync</span>
        </div>
        <div>
          v2.4.0-production • Release 2026
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('feed');

  return (
    <AuthProvider>
      <AppBody currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </AuthProvider>
  );
}

