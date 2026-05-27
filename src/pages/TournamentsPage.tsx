/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, 
  MapPin, 
  Calendar, 
  Search, 
  Filter, 
  Plus, 
  Users, 
  Award, 
  Zap, 
  Compass, 
  CheckCircle, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Tournament, Sport, Team, Match, ScheduleType, TournamentStatus } from '../types';

export default function TournamentsPage() {
  const { user, profile, isOrganizer, isAdmin } = useAuth();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tournament | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'fixtures' | 'rosters' | 'register' | 'standings'>('fixtures');
  
  const matchedSportDetail = selectedTour ? sports.find(s => s.id === selectedTour.sportId) : null;
  
  // Create Tournament form state
  const [newTourName, setNewTourName] = useState('');
  const [newTourDesc, setNewTourDesc] = useState('');
  const [newTourSport, setNewTourSport] = useState('football');
  const [newTourFormat, setNewTourFormat] = useState<ScheduleType>('round-robin');
  const [newTourVenue, setNewTourVenue] = useState('');
  const [newTourLimit, setNewTourLimit] = useState(8);
  const [newTourStart, setNewTourStart] = useState('');
  const [newTourEnd, setNewTourEnd] = useState('');

  // Register Team form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [playerList, setPlayerList] = useState<string[]>(['']);

  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load sports catalog
  useEffect(() => {
    fetch('/api/sports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSports(data);
        }
      })
      .catch(err => console.error('Failed to load sports list:', err));
  }, []);

  // Sync tournaments, matches and teams from Firestore in real-time
  useEffect(() => {
    const unsubTours = onSnapshot(collection(db, 'tournaments'), (snap) => {
      const list: Tournament[] = [];
      snap.forEach(d => list.push(d.data() as Tournament));
      setTournaments(list);
    }, err => handleFirestoreError(err, OperationType.GET, 'tournaments'));

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const list: Team[] = [];
      snap.forEach(d => list.push(d.data() as Team));
      setTeams(list);
    }, err => handleFirestoreError(err, OperationType.GET, 'teams'));

    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => {
      const list: Match[] = [];
      snap.forEach(d => list.push(d.data() as Match));
      setMatches(list);
    }, err => handleFirestoreError(err, OperationType.GET, 'matches'));

    return () => {
      unsubTours();
      unsubTeams();
      unsubMatches();
    };
  }, []);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotifMsg({ text, type });
    setTimeout(() => setNotifMsg(null), 4000);
  };

  // Create Tournament API call
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newTourName || !newTourDesc || !newTourVenue || !newTourStart || !newTourEnd) {
      triggerToast('Please complete all tournament fields!', 'error');
      return;
    }

    const tId = `tour-${Date.now()}`;
    const newDoc: Tournament = {
      id: tId,
      name: newTourName,
      description: newTourDesc,
      sportId: newTourSport,
      status: 'upcoming' as TournamentStatus,
      scheduleType: newTourFormat,
      teamLimit: Number(newTourLimit),
      startDate: newTourStart,
      endDate: newTourEnd,
      venue: newTourVenue,
      creatorId: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'tournaments', tId), {
        ...newDoc,
        createdAt: serverTimestamp() // rule strict Temporal Timestamps check
      });
      triggerToast('Tournament created successfully!');
      setShowAddModal(false);
      // Clean states
      setNewTourName('');
      setNewTourDesc('');
      setNewTourVenue('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `tournaments/${tId}`);
    }
  };

  // Register Team to tournament call
  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTour) return;

    const filteredPlayers = playerList.filter(p => p.trim() !== '');
    if (!newTeamName || filteredPlayers.length === 0) {
      triggerToast('Please provide a team name and list at least 1 player name!', 'error');
      return;
    }

    const teamCountInTour = teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved').length;
    if (teamCountInTour >= selectedTour.teamLimit) {
      triggerToast('Registration filled! Roster spaces have been capped.', 'error');
      return;
    }

    const teamId = `team-${Date.now()}`;
    const newTeam: Team = {
      id: teamId,
      name: newTeamName,
      tournamentId: selectedTour.id,
      registeredBy: user.uid,
      status: 'pending',
      players: filteredPlayers,
      logoUrl: newTeamLogo || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'teams', teamId), {
        ...newTeam,
        createdAt: serverTimestamp()
      });
      
      // Dispatch alert notify to original organizer
      try {
        const alertId = `notif-${Date.now()}`;
        await setDoc(doc(db, 'notifications', alertId), {
          id: alertId,
          userId: selectedTour.creatorId,
          title: 'New Team Roster Submission',
          message: `Roster "${newTeam.name}" has requested registration spot in your tournament "${selectedTour.name}".`,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn('Failed to send notification to organizer:', notifErr);
      }

      triggerToast('Roster request proposed! Waiting approval from organizer.');
      setNewTeamName('');
      setNewTeamLogo('');
      setPlayerList(['']);
      setActiveSubTab('rosters');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teams/${teamId}`);
    }
  };

  const addPlayerField = () => {
    setPlayerList([...playerList, '']);
  };

  const handlePlayerNameChange = (index: number, value: string) => {
    const list = [...playerList];
    list[index] = value;
    setPlayerList(list);
  };

  // Generate standing calculations from finalized matches dynamically (No fake stats!)
  const calculateStandings = () => {
    if (!selectedTour) return [];

    const approvedTeams = teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved');
    const matchedStats: { [teamId: string]: { points: number, wins: number, draws: number, losses: number, played: number, teamName: string } } = {};

    approvedTeams.forEach(t => {
      matchedStats[t.id] = { points: 0, wins: 0, draws: 0, losses: 0, played: 0, teamName: t.name };
    });

    const completedMatches = matches.filter(m => m.tournamentId === selectedTour.id && m.status === 'completed');

    completedMatches.forEach(m => {
      const hId = m.homeTeamId;
      const aId = m.awayTeamId;

      if (!matchedStats[hId] || !matchedStats[aId]) return;

      matchedStats[hId].played++;
      matchedStats[aId].played++;

      if (m.winnerId === hId) {
        matchedStats[hId].wins++;
        matchedStats[hId].points += 3;
        matchedStats[aId].losses++;
      } else if (m.winnerId === aId) {
        matchedStats[aId].wins++;
        matchedStats[aId].points += 3;
        matchedStats[hId].losses++;
      } else {
        // Draw
        matchedStats[hId].points += 1;
        matchedStats[aId].points += 1;
        matchedStats[hId].draws++;
        matchedStats[aId].draws++;
      }
    });

    return Object.values(matchedStats).sort((a,b) => b.points - a.points);
  };

  // Filter listings
  const filteredTournaments = tournaments.filter(t => {
    const matchSport = selectedSport === 'all' || t.sportId === selectedSport;
    const matchStatus = selectedStatus === 'all' || t.status === selectedStatus;
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        t.venue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSport && matchStatus && matchSearch;
  });

  return (
    <div className="py-6 space-y-8 text-left" id="bracket-root-arena">
      
      {/* Toast Alert */}
      {notifMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm animate-[bounce_0.5s_ease-out] ${
          notifMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-650 bg-red-650/90 text-white border border-red-500'
        }`}>
          {notifMsg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-bold leading-tight">{notifMsg.text}</span>
        </div>
      )}

      {/* 1. Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
            <Trophy className="text-blue-500 w-8 h-8" /> Active Tournament Arenas
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Browse upcoming formats or manage fixtures, dynamic standings and team registers
          </p>
        </div>

        {user && (isOrganizer || isAdmin) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-650 hover:bg-blue-600 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Host Tournament
          </button>
        )}
      </div>

      {/* 2. Advanced Search & Filtering Rails */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-850">
        
        {/* Search */}
        <div className="md:col-span-2 relative flex items-center">
          <Search className="w-4.5 h-4.5 absolute left-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search matching title, venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 pl-11 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Selected Sport Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white uppercase font-bold focus:outline-none cursor-pointer"
          >
            <option value="all">Any Sport</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Status selection */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white uppercase font-bold focus:outline-none cursor-pointer"
          >
            <option value="all">Any Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active Play</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* 3. Main Arena Layout */}
      {!selectedTour ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.length === 0 ? (
            <div className="col-span-full py-16 bg-slate-900/40 border border-slate-850 rounded-2xl text-center text-xs text-slate-500">
              No tournament arenas match the current filter selection.
            </div>
          ) : (
            filteredTournaments.map((tour) => {
              const matchedSport = sports.find(s => s.id === tour.sportId);
              const approvedTeamsCount = teams.filter(t => t.tournamentId === tour.id && t.status === 'approved').length;
              const completedMatchesCount = matches.filter(m => m.tournamentId === tour.id && m.status === 'completed').length;
              
              return (
                <div
                  key={tour.id}
                  onClick={() => {
                    setSelectedTour(tour);
                    setActiveSubTab('fixtures');
                  }}
                  className="group relative bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between cursor-pointer"
                >
                  {/* Category Image Header */}
                  <div className="h-24 overflow-hidden relative">
                    <img 
                      referrerPolicy="no-referrer"
                      src={matchedSport?.image || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=600'} 
                      alt={tour.name} 
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-slate-900/40" />
                    <span className="absolute bottom-2 left-4 text-xs font-semibold capitalize font-mono text-amber-400 bg-slate-950/60 border border-slate-800 px-2 py-0.5 rounded">
                      {tour.sportId}
                    </span>
                  </div>

                  <div className="p-4 space-y-4 flex-grow flex flex-col justify-between">
                    <div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border inline-block mb-2 ${
                        tour.status === 'upcoming' 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : tour.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-slate-850 text-slate-400 border-slate-700'
                      }`}>
                        {tour.status}
                      </span>
                      <h4 className="text-sm font-black text-slate-100 group-hover:text-blue-400 transition-colors tracking-tight line-clamp-1">
                        {tour.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {tour.description}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs font-semibold border-t border-slate-850 pt-3 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{tour.venue}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {new Date(tour.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} - {new Date(tour.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span>Roster Space:</span>
                        </span>
                        <span className="font-bold text-slate-200">
                          {approvedTeamsCount} / {tour.teamLimit} Approved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        // Detailed Expanded view mode
        <div className="space-y-6">
          
          {/* Detailed Back Segment */}
          <button
            onClick={() => setSelectedTour(null)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
          >
            ← Back to Bracket Arenas
          </button>

          {/* Detailed Branding showcase */}
          <div className="relative bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden min-h-[220px] flex flex-col justify-end">
            {/* Background cover image with heavy dark gradient overlay */}
            <img 
              referrerPolicy="no-referrer"
              src={matchedSportDetail?.image || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200'}
              alt={selectedTour.name} 
              className="absolute inset-0 w-full h-full object-cover transform scale-100 filter brightness-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent" />
            
            <div className="relative z-10 p-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
              <div className="space-y-3 max-w-xl text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-amber-400">
                    {selectedTour.sportId}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-slate-400">
                    {selectedTour.scheduleType}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                    selectedTour.status === 'upcoming' 
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                    {selectedTour.status}
                  </span>
                </div>
                
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight drop-shadow-md">{selectedTour.name}</h2>
                <p className="text-xs text-slate-200 leading-relaxed font-medium drop-shadow-sm">{selectedTour.description}</p>
                
                <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-300 font-semibold">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-blue-500" /> {selectedTour.venue}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-blue-500" /> {selectedTour.startDate} to {selectedTour.endDate}</span>
                </div>
              </div>

              {/* Registered limits stats check */}
              <div className="bg-slate-950/90 rounded-xl border border-slate-850 p-4 text-center space-y-1.5 shrink-0 w-full md:w-36 shadow-2xl backdrop-blur-md">
                <span className="text-[9px] text-slate-500 block uppercase font-extrabold tracking-wider">Approved Slots</span>
                <span className="text-2xl font-black text-white">
                  {teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved').length} <span className="text-xs text-slate-400">/ {selectedTour.teamLimit}</span>
                </span>
                <span className="text-[10px] text-blue-400 block font-bold uppercase tracking-wider">
                  {Math.max(0, selectedTour.teamLimit - teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved').length)} Left
                </span>
              </div>
            </div>
          </div>

          {/* Sub Navigation - Overflow scrollable for nice mobile feel */}
          <div className="flex border-b border-slate-800 text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              onClick={() => setActiveSubTab('fixtures')}
              className={`pb-3 px-4 font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeSubTab === 'fixtures' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Fixtures & Match Cards
            </button>
            <button
              onClick={() => setActiveSubTab('rosters')}
              className={`pb-3 px-4 font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeSubTab === 'rosters' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Approved Rosters
            </button>
            {user && (
              <button
                onClick={() => setActiveSubTab('register')}
                className={`pb-3 px-4 font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                  activeSubTab === 'register' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Register Your Team
              </button>
            )}
            <button
              onClick={() => setActiveSubTab('standings')}
              className={`pb-3 px-4 font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeSubTab === 'standings' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Standings Chart
            </button>
          </div>

          {/* Expanded Layout Subviews */}
          {activeSubTab === 'fixtures' && (
            <div className="space-y-4">
              <div className="flex justify-between items-baseline pt-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Scheduled Matches</h3>
                <span className="text-xs text-slate-500 font-mono">
                  {matches.filter(m => m.tournamentId === selectedTour.id).length} Match Brackets
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.filter(m => m.tournamentId === selectedTour.id).length === 0 ? (
                  <div className="col-span-full py-12 bg-slate-900/30 border border-slate-850 rounded-2xl text-center text-xs text-slate-500">
                    No matches have been generated yet. Tournament requires team approvals.
                  </div>
                ) : (
                  matches.filter(m => m.tournamentId === selectedTour.id).map((match) => (
                    <div 
                      key={match.id}
                      className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4 text-xs font-semibold"
                    >
                      <div className="text-left w-1/3">
                        <span className="text-[10px] text-slate-500 block">HOME</span>
                        <span className="text-slate-100 font-black text-sm block truncate pr-1">{match.homeTeamName}</span>
                      </div>

                      <div className="text-center shrink-0">
                        <span className="text-[10px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-amber-400 block mb-1">
                          {match.round}
                        </span>
                        <div className="text-base font-black text-slate-100 py-1">
                          {match.score.homeScore} - {match.score.awayScore}
                        </div>
                        <span className="text-[9px] text-slate-500 block uppercase tracking-wide">
                          {match.status}
                        </span>
                      </div>

                      <div className="text-right w-1/3">
                        <span className="text-[10px] text-slate-500 block">AWAY</span>
                        <span className="text-slate-100 font-black text-sm block truncate pl-1">{match.awayTeamName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'rosters' && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Approved Rosters</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved').length === 0 ? (
                  <div className="col-span-full py-12 bg-slate-900/30 border border-slate-850 rounded-2xl text-center text-xs text-slate-500">
                    No approved teams on roster sheet yet.
                  </div>
                ) : (
                  teams.filter(t => t.tournamentId === selectedTour.id && t.status === 'approved').map((team) => (
                    <div 
                      key={team.id}
                      className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-left"
                    >
                      <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase block">ACTIVE TEAM</span>
                      <h4 className="text-base font-black text-slate-100 mt-1">{team.name}</h4>
                      
                      <div className="mt-3">
                        <span className="text-[10px] text-slate-500 block font-extrabold">ATHLETES ROSTER</span>
                        <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
                          {team.players.join(', ')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'register' && (
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl text-left transition-all">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Register Your Team</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Fill the roster form below to propose list registration. Captain must belong as a authenticated verified user.
              </p>

              <form onSubmit={handleRegisterTeam} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Team Name *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white uppercase focus:outline-none focus:border-orange-500"
                      placeholder="e.g. SLAMMERS FC"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Roster Emblem Logo URL (Optional)</label>
                    <input
                      type="url"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                      placeholder="e.g. https://images.unsplash.com/..."
                      value={newTeamLogo}
                      onChange={(e) => setNewTeamLogo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Athletes Roster list *</label>
                  {playerList.map((player, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                        placeholder={`Athlete #${idx + 1} Name`}
                        value={player}
                        required={idx === 0}
                        onChange={(e) => handlePlayerNameChange(idx, e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPlayerField}
                    className="mt-2 text-xs text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                  >
                    + Add Roster Member
                  </button>
                </div>

                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer block"
                >
                  Submit Roster Proposals
                </button>
              </form>
            </div>
          )}

          {activeSubTab === 'standings' && (
            <div className="space-y-4 text-left">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Standings Table</h3>
              
              <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-900">
                <table className="w-full text-xs text-slate-400">
                  <thead className="bg-slate-950 uppercase text-[10px] font-extrabold border-b border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-3 px-4 text-left w-12">POS</th>
                      <th className="py-3 px-4 text-left">TEAM NAME</th>
                      <th className="py-3 px-4 text-center">PLAYED</th>
                      <th className="py-3 px-4 text-center">W</th>
                      <th className="py-3 px-4 text-center">D</th>
                      <th className="py-3 px-4 text-center">L</th>
                      <th className="py-3 px-4 text-right pr-6">POINTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {calculateStandings().length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-semibold">
                          No standings generated yet.
                        </td>
                      </tr>
                    ) : (
                      calculateStandings().map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-850/30 transition-colors">
                          <td className="py-3 px-4 text-slate-100 font-black">{idx + 1}</td>
                          <td className="py-3 px-4 text-slate-100 font-bold">{row.teamName}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold">{row.played}</td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-400 font-bold">{row.wins}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold">{row.draws}</td>
                          <td className="py-3 px-4 text-center font-mono text-red-400 font-bold">{row.losses}</td>
                          <td className="py-3 px-4 text-right pr-6 font-mono text-amber-400 font-black text-sm">
                            {row.points}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 4. Host/Create Tournament Overlay Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-white">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-tight">Host New Sports Tournament</h3>
            
            <form onSubmit={handleCreateTournament} className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Tournament Title *</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white uppercase focus:outline-none focus:border-orange-500"
                  placeholder="e.g. CHAMPIONS PREMIER CRICKET"
                  value={newTourName}
                  onChange={(e) => setNewTourName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Detailed Description *</label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500 h-20 resize-none"
                  placeholder="Provide schedule format details, team limits and rosters guidelines..."
                  value={newTourDesc}
                  onChange={(e) => setNewTourDesc(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Sport Category *</label>
                  <select
                    value={newTourSport}
                    onChange={(e) => setNewTourSport(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none uppercase font-bold"
                  >
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Fixtures Formats *</label>
                  <select
                    value={newTourFormat}
                    onChange={(e) => setNewTourFormat(e.target.value as ScheduleType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none uppercase font-bold"
                  >
                    <option value="round-robin">Round-Robin League</option>
                    <option value="knockout">Knockout Brackets</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Physical Venue / Court *</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white uppercase focus:outline-none focus:border-orange-500"
                    placeholder="e.g. Arena Court A"
                    value={newTourVenue}
                    onChange={(e) => setNewTourVenue(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Roster Team Limit *</label>
                  <input
                    type="number"
                    min="2"
                    max="128"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                    value={newTourLimit}
                    onChange={(e) => setNewTourLimit(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Start Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                    value={newTourStart}
                    onChange={(e) => setNewTourStart(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">End Date *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                    value={newTourEnd}
                    onChange={(e) => setNewTourEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Assemble Arena
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
