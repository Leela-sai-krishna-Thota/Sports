/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, 
  MapPin, 
  Flame, 
  Calendar, 
  ChevronRight, 
  Zap, 
  Award, 
  Users, 
  Play
} from 'lucide-react';
import { collection, query, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Sport, Tournament, Match, Team } from '../types';

export default function Home({ onChangeTab }: { onChangeTab: (tab: string) => void }) {
  const { signInWithGoogle, user } = useAuth();
  const [sports, setSports] = useState<Sport[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Load sports list from backend seeding API
  useEffect(() => {
    fetch('/api/sports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSports(data);
        }
      })
      .catch(err => {
        console.error('Failed to load seeded sports catalog:', err);
      });
  }, []);

  // Fetch featured tournaments & live matches in real-time
  useEffect(() => {
    const tourQuery = query(collection(db, 'tournaments'), limit(6));
    const unsubTours = onSnapshot(tourQuery, (snap) => {
      const list: Tournament[] = [];
      snap.forEach(doc => {
        list.push(doc.data() as Tournament);
      });
      setTournaments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tournaments');
    });

    const matchQuery = query(collection(db, 'matches'), limit(4));
    const unsubMatches = onSnapshot(matchQuery, (snap) => {
      const list: Match[] = [];
      snap.forEach(doc => {
        list.push(doc.data() as Match);
      });
      // Sort priority: Live matches first, then upcoming
      list.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
      });
      setLiveMatches(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches');
    });

    return () => {
      unsubTours();
      unsubMatches();
    };
  }, []);

  return (
    <div className="space-y-10 py-6" id="home-portal-view">
      
      {/* 1. Hero Showcase Section */}
      <section className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col md:flex-row items-center gap-8 justify-between">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-xl text-left space-y-4">
          <div className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 fill-blue-400" /> Auto-Scheduler Connected
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Elevate Your <span className="bg-gradient-to-r from-blue-450 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Tournaments</span> to Elite Pro Status.
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed font-semibold">
            Generate brackets, schedule matches, allocate courts/venues automatically, and update scores in real-time. Power your leagues using modern round-robin and knockout automation.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            {user ? (
              <button
                onClick={() => onChangeTab('tournaments')}
                className="bg-blue-650 hover:bg-blue-600 text-white font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all transform hover:scale-105 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                Browse Tournaments
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all transform hover:scale-105 cursor-pointer shadow-lg shadow-blue-500/15"
              >
                Join Athlete Portal
              </button>
            )}
            <button
              onClick={() => onChangeTab('tournaments')}
              className="border border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Feature Visual */}
        <div className="relative shrink-0 w-full md:w-80 h-56 bg-slate-850 rounded-2xl border border-slate-700/60 p-4 shadow-inner flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Play className="w-3 h-3 text-blue-500 fill-blue-500" /> LIVE STATS
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-550 animate-ping" />
          </div>
          
          <div className="py-4 space-y-2">
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Platform Athletes</span>
              <span className="text-3xl font-black text-white">493+</span>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Active Pro Matches</span>
              <span className="text-sm font-semibold text-blue-400">Synchronized via Firestore</span>
            </div>
          </div>
          
          <div className="text-[10px] font-mono text-slate-500 text-right bg-slate-900/60 p-1.5 rounded border border-slate-800">
            Node / Express / Cloud Run API
          </div>
        </div>
      </section>

      {/* 2. Sports Category Carousel */}
      <section className="space-y-4">
        <div className="flex justify-between items-baseline">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Sports Categories</h2>
            <p className="text-xs text-slate-400">Explore dynamic disciplines seeded from our custom Express databases</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sports.length === 0 ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-44 bg-slate-900 border border-slate-800 animate-pulse rounded-2xl" />
            ))
          ) : (
            sports.map((sport) => (
              <div 
                key={sport.id}
                className="group relative bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:border-slate-700/80 transition-all flex flex-col justify-between"
              >
                {/* Background image preview with darkened screen */}
                <div className="h-28 overflow-hidden relative">
                  <img 
                    referrerPolicy="no-referrer"
                    src={sport.image} 
                    alt={sport.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                  <span className="absolute bottom-3 left-4 text-lg font-black text-white tracking-wide uppercase">
                    {sport.name}
                  </span>
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <p className="text-slate-400 text-xs text-left leading-relaxed">{sport.description}</p>
                  
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 border-t border-slate-800/60 pt-3">
                    <span>TEAM BOUNDARY: <span className="text-blue-400">{sport.teamSize} Players</span></span>
                    <button
                      onClick={() => onChangeTab('tournaments')}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    >
                      Browse leagues <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. Live & Upcoming Matches */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Match Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Active Scoring Board</h2>
            <p className="text-xs text-slate-400">Real-time match events automatically synchronized via Firestore snapshot listeners</p>
          </div>

          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="h-32 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
              ))
            ) : liveMatches.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800/60 text-slate-400 text-xs py-10 rounded-2xl text-center">
                No scheduled match fixtures. High-level organizers must generate brackets first.
              </div>
            ) : (
              liveMatches.map((match) => (
                <div 
                  key={match.id}
                  className={`bg-slate-900 border rounded-2xl p-4 md:p-5 transition-all flex flex-col md:flex-row items-center justify-between gap-4 ${
                    match.status === 'live' 
                      ? 'border-blue-500/30 bg-gradient-to-r from-slate-900 to-blue-950/20' 
                      : 'border-slate-850 bg-slate-900/70 hover:border-slate-700/80'
                  }`}
                >
                  {/* Status Badges */}
                  <div className="flex md:flex-col justify-between md:justify-center items-start w-full md:w-auto shrink-0 text-left gap-1.5">
                    {match.status === 'live' ? (
                      <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-550 animate-ping" /> LIVE IN PLAY
                      </span>
                    ) : match.status === 'completed' ? (
                      <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Award className="w-3 h-3 text-blue-400" /> COMPLETED
                      </span>
                    ) : (
                      <span className="bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> SCHEDULED
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {new Date(match.matchDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block truncate max-w-[120px] uppercase">
                      📍 {match.venue}
                    </span>
                  </div>

                  {/* Competitors scores */}
                  <div className="flex items-center justify-around flex-grow w-full max-w-sm gap-2">
                    {/* Home Team */}
                    <div className="text-center w-28 truncate">
                      <div className="w-10 h-10 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                        {match.homeTeamName[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-200 block truncate">{match.homeTeamName}</span>
                    </div>

                    {/* Scores display */}
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-black ${match.winnerId === match.homeTeamId ? 'text-blue-400' : 'text-white'}`}>
                        {match.score?.homeScore ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">VS</span>
                      <span className={`text-2xl font-black ${match.winnerId === match.awayTeamId ? 'text-blue-400' : 'text-white'}`}>
                        {match.score?.awayScore ?? 0}
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="text-center w-28 truncate">
                      <div className="w-10 h-10 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                        {match.awayTeamName[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-200 block truncate">{match.awayTeamName}</span>
                    </div>
                  </div>

                  {/* Sport specification */}
                  <div className="shrink-0 text-slate-500 text-[10px] font-bold tracking-wider capitalize border border-slate-800 px-3 py-1 rounded bg-slate-950/40">
                    🏆 {match.sportId} ({match.round || 'Regular'})
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Featured Tournaments */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Active Tournaments</h2>
            <p className="text-xs text-slate-400">Recent brackets open for roster submissions</p>
          </div>

          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-4 text-left">
            {tournaments.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">
                No featured leagues found.
              </div>
            ) : (
              tournaments.map((tour) => (
                <div 
                  key={tour.id}
                  onClick={() => onChangeTab('tournaments')}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-slate-800 hover:border-slate-700/60 hover:bg-slate-850/45 transition-all cursor-pointer"
                >
                  <div className="p-2.5 bg-slate-800 rounded-lg group-hover:bg-blue-600 group-hover:text-white text-blue-400 transition-colors">
                    <Trophy className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-grow select-none">
                    <span className="text-xs font-bold text-slate-200 block group-hover:text-blue-400 transition-colors truncate">
                      {tour.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block capitalize">
                      {tour.sportId} • {tour.scheduleType}
                    </span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    tour.status === 'upcoming' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {tour.status}
                  </span>
                </div>
              ))
            )}

            <button
              onClick={() => onChangeTab('tournaments')}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-700 hover:border-slate-500/80 bg-slate-900 hover:bg-slate-850 transition-all text-slate-400 hover:text-white text-xs font-extrabold py-3 rounded-xl cursor-pointer"
            >
              View Tournament Arenas <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Leaderboard / Standings Preview */}
      <section className="bg-slate-900 border border-slate-850 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-left space-y-3 max-w-lg">
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            League Standing & Roster Rankings
          </h2>
          <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-semibold">
            Track champion scores, goal splits, cricket run differences, and general team standings instantly. Standings update auto-magically once match outcomes are reported by organizers.
          </p>
          <button 
            onClick={() => onChangeTab('tournaments')}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-extrabold px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Explore Active Standings <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full max-w-sm overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/40 p-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            <span>TEAM CHAMPIONS</span>
            <span>WIN RATIO</span>
          </div>
          <div className="divide-y divide-slate-850 pt-2 text-xs">
            <div className="flex justify-between items-center py-2.5">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="text-blue-400 font-extrabold">1.</span> Strikers FC
              </span>
              <span className="font-mono text-emerald-400 font-bold">100% (4-0)</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="text-slate-400 font-extrabold">2.</span> Titans CC
              </span>
              <span className="font-mono text-emerald-400 font-bold">75% (3-1)</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="text-slate-500 font-extrabold">3.</span> Slammers
              </span>
              <span className="font-mono text-slate-400 font-bold">50% (2-2)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
