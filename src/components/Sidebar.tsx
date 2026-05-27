/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, 
  Calendar, 
  LayoutDashboard, 
  Briefcase, 
  User, 
  Compass, 
  UsersRound,
  ShieldEllipsis
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
}

export default function Sidebar({ currentTab, onChangeTab }: SidebarProps) {
  const { user, isOrganizer, isAdmin } = useAuth();

  const navigationItems = [
    { id: 'feed', label: 'Explore Portal', icon: Compass },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  ];

  const authenticatedItems = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  ];

  const adminOrganizerItems = [
    { id: 'admin', label: 'Admin Hub', icon: ShieldEllipsis }
  ];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900/30 border-r border-slate-800 flex-col justify-between p-6 text-slate-200 shrink-0 font-sans" id="sidebar-nav">
      <div className="space-y-6">
        {/* Menu Section */}
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold px-3">
            General Navigation
          </span>
          <div className="mt-3 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500 rounded-lg font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  } text-left cursor-pointer`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Authenticated User Segment */}
        {user && (
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold px-3">
              Player Lounge
            </span>
            <div className="mt-3 space-y-1">
              {authenticatedItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500 rounded-lg font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    } text-left cursor-pointer`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Administrative segment */}
        {user && (isOrganizer || isAdmin) && (
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold px-3">
              Operations Center
            </span>
            <div className="mt-3 space-y-1">
              {adminOrganizerItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChangeTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border-l-2 border-blue-500 rounded-lg font-extrabold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    } text-left cursor-pointer`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sleek Pro Support Card */}
      <div className="mt-auto p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-left">
        <p className="text-sm font-bold text-white">Pro Organizer</p>
        <p className="text-[11px] text-blue-100 mt-1 opacity-80 leading-normal">
          Access advanced bracket generators and dynamic standings syncing.
        </p>
        <button 
          onClick={() => onChangeTab('tournaments')}
          className="mt-3 w-full bg-white text-blue-700 text-xs font-bold py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Explore Arenas
        </button>
      </div>
    </aside>
  );
}
