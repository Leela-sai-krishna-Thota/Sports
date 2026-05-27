/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  MapPin, 
  Trophy, 
  Calendar, 
  Settings, 
  Bell, 
  UsersRound, 
  CheckCircle, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Team, Tournament, Match } from '../types';

export default function Dashboard() {
  const { user, profile, refreshProfile, signInWithGoogle } = useAuth();
  
  const [captainTeams, setCaptainTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<{ [id: string]: Tournament }>({});
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
      setEditPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPrivateData = async () => {
      try {
        // Fetch teams captained by User
        const teamsQuery = query(collection(db, 'teams'), where('registeredBy', '==', user.uid));
        const teamsSnap = await getDocs(teamsQuery);
        const myTeams: Team[] = [];
        teamsSnap.forEach(docSnap => {
          myTeams.push(docSnap.data() as Team);
        });
        setCaptainTeams(myTeams);

        // Fetch associated tournaments
        if (myTeams.length > 0) {
          const tIds = [...new Set(myTeams.map(t => t.tournamentId))];
          const toursMap: { [id: string]: Tournament } = {};
          
          for (const tId of tIds) {
            const tSnap = await getDocs(query(collection(db, 'tournaments'), where('id', '==', tId)));
            tSnap.forEach(docSnap => {
              const data = docSnap.data() as Tournament;
              toursMap[data.id] = data;
            });
          }
          setTournaments(toursMap);

          // Fetch matches involving our teams
          const approvedTeamIds = myTeams.filter(t => t.status === 'approved').map(t => t.id);
          if (approvedTeamIds.length > 0) {
            const allMatchesSnap = await getDocs(collection(db, 'matches'));
            const matches: Match[] = [];
            allMatchesSnap.forEach(d => {
              const m = d.data() as Match;
              if (approvedTeamIds.includes(m.homeTeamId) || approvedTeamIds.includes(m.awayTeamId)) {
                matches.push(m);
              }
            });
            matches.sort((a,b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
            setUserMatches(matches);
          }
        }
      } catch (err) {
        console.error('Error compiling dashboard assets:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPrivateData();
  }, [user]);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotifMsg({ text, type });
    setTimeout(() => setNotifMsg(null), 4000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!editName.trim()) {
      triggerToast('Full Name cannot be empty!', 'error');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editName,
        phone: editPhone || null
      });
      await refreshProfile();
      triggerToast('Athlete profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (!user) {
    return (
      <div className="py-16 text-center space-y-6 max-w-sm mx-auto" id="dashboard-anon-barrier">
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
          <User className="w-8 h-8 text-orange-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Athlete Lounge</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
            Login utilizing safe Google Single-Sign-On to register teams, analyze calendar schedules, and adapt customized profile states.
          </p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all transform hover:scale-[1.03] shadow-lg shadow-orange-500/20 cursor-pointer"
        >
          Access Player Portal
        </button>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8 text-left" id="dashboard-user-lounge">
      
      {/* Toast Banner */}
      {notifMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm animate-[bounce_0.5s_ease-out] ${
          notifMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-650 bg-red-650/90 text-white'
        }`}>
          {notifMsg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-bold leading-tight">{notifMsg.text}</span>
        </div>
      )}

      {/* 1. Header welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-orange-500">ATHLETE PROFILE DESK</span>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mt-0.5">
            Welcome Back, <span className="text-amber-400">{profile?.name || user.displayName || 'Athlete'}</span>
          </h1>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-colors"
        >
          <Settings className="w-4 h-4" /> {isEditing ? 'View Roster Metrics' : 'Edit Profile'}
        </button>
      </div>

      {isEditing ? (
        // EDIT PROFILE SCREEN
        <div className="max-w-xl bg-slate-900 border border-slate-850 p-6 rounded-2xl">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Modify Profile Details</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">Modify your athlete identifiers for tournament team coordinators.</p>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Athlete Full Name *</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Contact Phone Number</label>
              <input
                type="tel"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                placeholder="e.g. +1 555-0199"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Save Profile
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        // STANDARD DASHBOARD METRICS
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main list of captained rosters */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Captain's Team Registrations */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <UsersRound className="w-5.5 h-5.5 text-orange-500" /> My Submitted Rosters
              </h2>

              <div className="space-y-4">
                {captainTeams.length === 0 ? (
                  <div className="p-10 bg-slate-900/40 border border-slate-850 rounded-2xl text-center text-xs text-slate-550">
                    No submitted rosters found under your control. Visit the 🏆 Tournaments page to propose team registrations.
                  </div>
                ) : (
                  captainTeams.map((team) => {
                    const matchedTour = tournaments[team.tournamentId];
                    return (
                      <div 
                        key={team.id}
                        className="bg-slate-900 border border-slate-850 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4"
                      >
                        <div className="text-left w-full md:w-auto">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border inline-block mb-2.5 ${
                            team.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : team.status === 'rejected'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                          }`}>
                            {team.status}
                          </span>
                          
                          <h4 className="text-base font-black text-slate-100 uppercase tracking-tight">{team.name}</h4>
                          <span className="text-[10px] text-slate-500 block font-bold leading-relaxed mt-1">
                            LEAGUE: {matchedTour ? matchedTour.name : 'Resolving Category...'}
                          </span>
                        </div>

                        {/* Roster details */}
                        <div className="text-left w-full md:w-64">
                          <span className="text-[10px] text-slate-500 uppercase font-extrabold block">TEAM PLAYERS</span>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-semibold leading-relaxed truncate">
                            {team.players.join(', ')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* User Matches Feed */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Calendar className="w-5.5 h-5.5 text-orange-500" /> My Scheduled Match Calendar
              </h2>

              <div className="space-y-4">
                {userMatches.length === 0 ? (
                  <div className="py-8 bg-slate-900/45 border border-slate-850 rounded-2xl text-center text-xs text-slate-500">
                    No scheduled fixtures found for approved rosters under your control.
                  </div>
                ) : (
                  userMatches.map((match) => (
                    <div 
                      key={match.id}
                      className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4 text-xs font-semibold"
                    >
                      <div className="text-left w-1/3 truncate">
                        <span className="text-slate-100 font-extrabold text-[13px] block truncate">{match.homeTeamName}</span>
                      </div>
                      
                      <div className="text-center shrink-0">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold block text-amber-400">
                          {match.round}
                        </span>
                        <div className="inline-block bg-slate-950 border border-slate-850 px-3 py-1 rounded text-sm text-white font-black mt-1">
                          {match.score.homeScore} - {match.score.awayScore}
                        </div>
                        <span className="text-[9px] text-slate-550 block uppercase tracking-wide mt-1.5 font-mono">
                          {new Date(match.matchDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-right w-1/3 truncate">
                        <span className="text-slate-100 font-extrabold text-[13px] block truncate">{match.awayTeamName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* User Meta Card segment */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl text-left space-y-4">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-tight">Athlete Identification Card</h3>
              
              <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                {profile?.profileImage ? (
                  <img
                    referrerPolicy="no-referrer"
                    src={profile.profileImage}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full border border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center font-bold text-white text-sm">
                    {profile?.name[0] || 'A'}
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-slate-200 block">{profile?.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 block truncate max-w-[170px]">{profile?.email}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold text-slate-400">
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span>Role Authorization:</span>
                  <span className="text-amber-400 uppercase tracking-wider">{profile?.role || 'Player'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span>Phone Directory:</span>
                  <span className="text-white">{profile?.phone || 'Not Configured'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Roster submissions:</span>
                  <span className="text-white">{captainTeams.length} Teams</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
