/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Award, 
  MapPin, 
  Activity, 
  Check, 
  X, 
  RefreshCcw, 
  ShieldAlert, 
  PlusCircle, 
  Sliders, 
  ChevronRight,
  Sparkles,
  PieChart
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  writeBatch,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Tournament, Team, Match, Sport } from '../types';
import { generateRoundRobinFixtures, generateKnockoutFixtures } from '../utils/scheduler';

export default function AdminPanel() {
  const { user, profile, isAdmin, isOrganizer } = useAuth();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  
  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  
  // Scoring updates state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [homeScoreInput, setHomeScoreInput] = useState(0);
  const [awayScoreInput, setAwayScoreInput] = useState(0);
  const [matchStatusInput, setMatchStatusInput] = useState<any>('upcoming');
  const [matchVenueInput, setMatchVenueInput] = useState('');
  
  // Tournament Creation Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTourName, setNewTourName] = useState('');
  const [newTourDesc, setNewTourDesc] = useState('');
  const [newTourSport, setNewTourSport] = useState('football');
  const [newTourFormat, setNewTourFormat] = useState<'round-robin' | 'knockout'>('round-robin');
  const [newTourVenue, setNewTourVenue] = useState('');
  const [newTourLimit, setNewTourLimit] = useState(8);
  const [newTourStart, setNewTourStart] = useState('');
  const [newTourEnd, setNewTourEnd] = useState('');
  const [creatingTournament, setCreatingTournament] = useState(false);

  const [selectedTourId, setSelectedTourId] = useState<string>('');
  
  const [notifMsg, setNotifMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleSeedDemoTournaments = async () => {
    if (!user) return;
    setSeedingDemo(true);
    try {
      const creatorId = user.uid;
      const defaultTournaments: Tournament[] = [
        {
          id: 'demo-cricket',
          name: 'Elite Pro T20 Super Cup',
          description: 'The ultimate T20 cricket showdown. Join the arena with your pro XI to compete for the ultimate championship cup.',
          sportId: 'cricket',
          status: 'upcoming',
          scheduleType: 'round-robin',
          teamLimit: 8,
          startDate: '2026-06-01',
          endDate: '2026-06-15',
          venue: 'Melbourne Cricket Ground',
          creatorId,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-football',
          name: 'SportFlow Soccer Champions League',
          description: 'Elite football knockout league. Face off against premier squads worldwide under high tension stadium lights.',
          sportId: 'football',
          status: 'upcoming',
          scheduleType: 'knockout',
          teamLimit: 12,
          startDate: '2026-06-05',
          endDate: '2026-06-25',
          venue: 'Wembley Stadium, London',
          creatorId,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-basketball',
          name: 'Madison Square Garden Pro Dunkers',
          description: 'Fast-paced courtside rhythm, high-flying slam dunks, and strategic three-pointers.',
          sportId: 'basketball',
          status: 'upcoming',
          scheduleType: 'round-robin',
          teamLimit: 6,
          startDate: '2026-06-10',
          endDate: '2026-06-20',
          venue: 'Madison Square Garden, NY',
          creatorId,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-volleyball',
          name: 'Coastal Golden Spike Volley Fest',
          description: 'Coastal gold spikes and layout digs on premium court grids. Intense outdoor 6v6 action.',
          sportId: 'volleyball',
          status: 'upcoming',
          scheduleType: 'round-robin',
          teamLimit: 8,
          startDate: '2026-06-12',
          endDate: '2026-06-22',
          venue: 'Manhattan Beach Court, CA',
          creatorId,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-badminton',
          name: 'Golden Racket Badminton Open',
          description: 'Lightning-fast badminton double racket duels, drop-shots and quick bird smash showdowns.',
          sportId: 'badminton',
          status: 'upcoming',
          scheduleType: 'knockout',
          teamLimit: 8,
          startDate: '2026-06-18',
          endDate: '2026-06-25',
          venue: 'Saitama Indoor Venue, Tokyo',
          creatorId,
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-kabaddi',
          name: 'Pro Raiders Kabaddi Arena',
          description: 'Elite kabaddi raids and defensive locks. Intense ancient wrestling rules with authentic points boards.',
          sportId: 'kabaddi',
          status: 'upcoming',
          scheduleType: 'round-robin',
          teamLimit: 6,
          startDate: '2026-06-22',
          endDate: '2026-06-30',
          venue: 'Tau Devi Lal Stadium, India',
          creatorId,
          createdAt: new Date().toISOString()
        }
      ];

      const batch = writeBatch(db);
      defaultTournaments.forEach((tour) => {
        const docRef = doc(db, 'tournaments', tour.id);
        batch.set(docRef, tour);
      });

      await batch.commit();
      triggerToast('Demo tournaments loaded for all 6 sports!');
    } catch (err) {
      console.error('Seeding demand failed:', err);
      triggerToast('Permission denied or seed failed.', 'error');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleCreateTournamentSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newTourName.trim() || !newTourDesc.trim() || !newTourVenue.trim() || !newTourStart || !newTourEnd) {
      triggerToast('Please fill out all tournament detail fields.', 'error');
      return;
    }

    if (newTourLimit < 2 || newTourLimit > 128) {
      triggerToast('Team boundaries must be between 2 and 128.', 'error');
      return;
    }

    setCreatingTournament(true);
    const tId = `tour-${Date.now()}`;
    const newDoc = {
      id: tId,
      name: newTourName.trim(),
      description: newTourDesc.trim(),
      sportId: newTourSport,
      status: 'upcoming',
      scheduleType: newTourFormat,
      teamLimit: Number(newTourLimit),
      startDate: newTourStart,
      endDate: newTourEnd,
      venue: newTourVenue.trim(),
      creatorId: user.uid,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'tournaments', tId), newDoc);
      triggerToast('New tournament published and listed successfully!');
      
      // Select the newly created tournament automatically
      setSelectedTourId(tId);
      
      // Close modal & reset fields
      setShowCreateModal(false);
      setNewTourName('');
      setNewTourDesc('');
      setNewTourVenue('');
      setNewTourStart('');
      setNewTourEnd('');
      setNewTourLimit(8);
      setNewTourFormat('round-robin');
      if (sports.length > 0) {
        setNewTourSport(sports[0].id);
      } else {
        setNewTourSport('football');
      }
    } catch (err: any) {
      console.error('Failed to create new tournament:', err);
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tId}`);
      triggerToast(err.message || 'Permission denied or fail writing registry data.', 'error');
    } finally {
      setCreatingTournament(false);
    }
  };

  useEffect(() => {
    // Sync sports catalog
    fetch('/api/sports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSports(data);
        }
      });
  }, []);

  // Fetch collections
  useEffect(() => {
    const unsubTours = onSnapshot(collection(db, 'tournaments'), (snap) => {
      const list: Tournament[] = [];
      snap.forEach(d => {
        const item = d.data() as Tournament;
        // Organizers can edit ONLY their own tournament events. Admins edit all.
        if (isAdmin || item.creatorId === user?.uid) {
          list.push(item);
        }
      });
      setTournaments(list);
      if (list.length > 0 && !selectedTourId) {
        setSelectedTourId(list[0].id);
      }
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const list: Team[] = [];
      snap.forEach(d => list.push(d.data() as Team));
      setTeams(list);
    });

    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => {
      const list: Match[] = [];
      snap.forEach(d => list.push(d.data() as Match));
      setMatches(list);
    });

    return () => {
      unsubTours();
      unsubTeams();
      unsubMatches();
    };
  }, [user, isAdmin]);

  // Compute analytics dynamically from active client listeners & quick users query
  const fetchAnalytics = async () => {
    if (!user) return;
    setLoadingAnalytics(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;

      const totalTournaments = tournaments.length;
      const totalTeams = teams.length;

      let activeMatches = 0;
      let completedMatches = 0;
      matches.forEach((m) => {
        if (m.status === 'live' || m.status === 'upcoming') {
          activeMatches++;
        } else if (m.status === 'completed') {
          completedMatches++;
        }
      });

      const sportsSplit: { [key: string]: number } = {};
      tournaments.forEach(t => {
        sportsSplit[t.sportId] = (sportsSplit[t.sportId] || 0) + 1;
      });

      const rolesSplit = { Admin: 0, Organizer: 0, Player: 0 };
      usersSnap.forEach(d => {
        const u = d.data();
        if (u.role === 'Admin') rolesSplit.Admin++;
        else if (u.role === 'Organizer') rolesSplit.Organizer++;
        else rolesSplit.Player++;
      });

      setAnalytics({
        counters: {
          totalUsers,
          totalTournaments,
          totalTeams,
          activeMatches,
          completedMatches
        },
        sportsSplit,
        rolesSplit
      });
    } catch (err) {
      console.error('Failed to load backend analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user, tournaments, teams, matches]);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotifMsg({ text, type });
    setTimeout(() => setNotifMsg(null), 3500);
  };

  // Automated scheduling client-side action
  const handleGenerateMatches = async (tourId: string) => {
    if (!user) return;
    try {
      const tournament = tournaments.find(t => t.id === tourId);
      if (!tournament) {
        triggerToast('Tournament registry not found.', 'error');
        return;
      }

      // Filter approved teams
      const approvedTeams = teams.filter(t => t.tournamentId === tourId && t.status === 'approved');
      if (approvedTeams.length < 2) {
        triggerToast('Need at least 2 approved teams to generate fixtures!', 'error');
        return;
      }

      // GenerateMatches and clear old ones
      const fixtures = tournament.scheduleType === 'round-robin'
        ? generateRoundRobinFixtures(approvedTeams, tournament)
        : generateKnockoutFixtures(approvedTeams, tournament);

      // Clean existing matches for this tournament first
      const existingMatches = matches.filter(m => m.tournamentId === tourId);

      const batch = writeBatch(db);
      
      // Delete old ones
      existingMatches.forEach((m) => {
        const docRef = doc(db, 'matches', m.id);
        batch.delete(docRef);
      });

      // Write new fixtures
      const now = new Date().toISOString();
      fixtures.forEach((m) => {
        const docRef = doc(db, 'matches', m.id);
        batch.set(docRef, {
          ...m,
          createdAt: now,
          updatedAt: now
        });
      });

      // Reset tournament status to active
      const tournamentRef = doc(db, 'tournaments', tourId);
      batch.update(tournamentRef, { status: 'active' });

      await batch.commit();
      triggerToast('Bracket fixtures scheduled successfully!');
    } catch (error) {
      console.error('Error generating scheduler bracket:', error);
      triggerToast('Fixture generation failed!', 'error');
    }
  };

  // Review team approvals (Approve/Reject)
  const handleTeamReview = async (teamId: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) {
        triggerToast('Team registration not found', 'error');
        return;
      }

      const batch = writeBatch(db);
      const teamRef = doc(db, 'teams', teamId);
      batch.update(teamRef, { status });

      // Notify Captain
      const notificationId = `notif-${Date.now()}`;
      const notifRef = doc(db, 'notifications', notificationId);
      batch.set(notifRef, {
        id: notificationId,
        userId: team.registeredBy,
        title: status === 'approved' ? 'Team Approved!' : 'Registration Update',
        message: `Your team "${team.name}" has been ${status} for the tournament.`,
        read: false,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      triggerToast(`Roster sheet ${status} and captain notified!`);
    } catch (err) {
      console.error('Error reviewing team:', err);
      triggerToast('Action failed or permission denied!', 'error');
    }
  };

  // Commit Score updates direct to client Firestore
  const handleSaveMatchScore = async (matchId: string) => {
    try {
      let winnerId: string | null = null;
      if (matchStatusInput === 'completed') {
        const match = matches.find(m => m.id === matchId);
        if (match) {
          if (homeScoreInput > awayScoreInput) winnerId = match.homeTeamId;
          else if (awayScoreInput > homeScoreInput) winnerId = match.awayTeamId;
        }
      }

      await updateDoc(doc(db, 'matches', matchId), {
        'score.homeScore': Number(homeScoreInput),
        'score.awayScore': Number(awayScoreInput),
        status: matchStatusInput,
        venue: matchVenueInput,
        winnerId,
        updatedAt: new Date().toISOString()
      });

      triggerToast('Live match metrics updated !');
      setEditingMatchId(null);
      fetchAnalytics();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `matches/${matchId}`);
    }
  };

  const startEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setHomeScoreInput(match.score.homeScore);
    setAwayScoreInput(match.score.awayScore);
    setMatchStatusInput(match.status);
    setMatchVenueInput(match.venue);
  };

  if (!isAdmin && !isOrganizer) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4" id="admin-security-trap">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="text-xl font-black text-rose-500 uppercase tracking-tight">Security Blocked</h2>
        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
          You lack operational clearances of Organizer or Admin classes. Return to home explore panels.
        </p>
      </div>
    );
  }

  const activeTourObj = tournaments.find(t => t.id === selectedTourId);
  const activeTourTeams = teams.filter(t => t.tournamentId === selectedTourId);
  const activeTourMatches = matches.filter(m => m.tournamentId === selectedTourId);

  return (
    <div className="py-6 space-y-8 text-left" id="admin-dashboard-root">
      
      {/* Toast notification message */}
      {notifMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-sm animate-[bounce_0.5s_ease-out] ${
          notifMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <Check className="w-5 h-5" />
          <span className="text-xs font-bold">{notifMsg.text}</span>
        </div>
      )}

       {/* 1. Header welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">
            League Administrations Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">
            Manage registrations review decks, generate matchups, and record points scores on live matches.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              if (sports.length > 0) {
                setNewTourSport(sports[0].id);
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 bg-gradient-to-tr from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-slate-950 font-black px-4 py-1.5 rounded-lg text-xs uppercase cursor-pointer shadow-md transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Create Tournament
          </button>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-extrabold px-3 py-1.5 rounded-lg text-xs uppercase cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Reload Analytics
          </button>
          <button
            onClick={handleSeedDemoTournaments}
            disabled={seedingDemo}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold px-4 py-1.5 rounded-lg text-xs uppercase cursor-pointer shadow shadow-blue-600/15"
          >
            ⚡ {seedingDemo ? 'Seeding...' : 'Seed Demo Tournaments'}
          </button>
        </div>
      </div>

      {/* 2. Visual Aggregation Analytics counters cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase block font-black">Registered Captains</span>
          <span className="text-2xl font-black text-white mt-1 block">
            {loadingAnalytics ? '...' : analytics?.counters?.totalUsers ?? '0'}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase block font-black">Active Leagues</span>
          <span className="text-2xl font-black text-amber-500 mt-1 block">
            {loadingAnalytics ? '...' : analytics?.counters?.totalTournaments ?? '0'}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase block font-black">Teams Registered</span>
          <span className="text-2xl font-black text-white mt-1 block">
            {loadingAnalytics ? '...' : analytics?.counters?.totalTeams ?? '0'}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase block font-black">Upcoming / Live Matches</span>
          <span className="text-2xl font-black text-sky-400 mt-1 block">
            {loadingAnalytics ? '...' : analytics?.counters?.activeMatches ?? '0'}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl col-span-2 lg:col-span-1">
          <span className="text-[10px] text-slate-500 uppercase block font-black">Matches Closed</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {loadingAnalytics ? '...' : analytics?.counters?.completedMatches ?? '0'}
          </span>
        </div>
      </div>

      {/* 3. Tournament selector selector element */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-850 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-left">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Select Tournament Event Area</label>
          <select
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
            className="w-full bg-slate-850 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white uppercase font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {tournaments.length === 0 ? (
              <option value="">No managed events found</option>
            ) : (
              tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
            )}
          </select>
        </div>

        {activeTourObj && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Quick schedule generator CTA */}
            <button
              onClick={() => handleGenerateMatches(activeTourObj.id)}
              className="flex items-center gap-1 bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              disabled={activeTourTeams.filter(t => t.status === 'approved').length < 2}
              title="Requires at least 2 approved teams on grid"
            >
              <Sparkles className="w-4 h-4" /> Auto-Generate Brackets
            </button>
          </div>
        )}
      </div>

      {activeTourObj ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Review registration approvals queue deck */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Users className="w-5.5 h-5.5 text-orange-500" /> Roster Approval Decks
            </h3>

            <div className="space-y-3">
              {activeTourTeams.length === 0 ? (
                <div className="py-12 bg-slate-900/40 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
                  No team rosters have registered for this tournament yet.
                </div>
              ) : (
                activeTourTeams.map((team) => (
                  <div 
                    key={team.id}
                    className="bg-slate-900 border border-slate-850 rounded-xl p-4 flex justify-between items-center gap-3 text-xs"
                  >
                    <div className="text-left max-w-[200px]">
                      <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border inline-block mb-1.5 font-bold ${
                        team.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : team.status === 'rejected'
                          ? 'bg-red-550/10 text-red-500 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>
                        {team.status}
                      </span>
                      <h4 className="font-bold text-slate-200 text-sm truncate">{team.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">Roster: {team.players.join(', ')}</p>
                    </div>

                    {team.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTeamReview(team.id, 'approved')}
                          className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/20 rounded-lg text-emerald-300 flex items-center cursor-pointer transition-colors"
                          title="Approve registration"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTeamReview(team.id, 'rejected')}
                          className="p-1.5 bg-red-650/20 hover:bg-red-650/40 border border-red-500/20 rounded-lg text-red-300 flex items-center cursor-pointer transition-colors"
                          title="Reject registration"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Matches lists and score reporting panels */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Calendar className="w-5.5 h-5.5 text-orange-500" /> Match Scores Live Reporting
            </h3>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {activeTourMatches.length === 0 ? (
                <div className="py-12 bg-slate-900/40 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
                  Brackets lack active matchups. Click "Auto-Generate Brackets" at top right of operations bar above.
                </div>
              ) : (
                activeTourMatches.map((match) => (
                  <div 
                    key={match.id}
                    className="bg-slate-900 border border-slate-850 p-4 rounded-xl text-xs space-y-4 font-semibold text-left"
                  >
                    {editingMatchId === match.id ? (
                      // EDIT SCORES/STATUS MODULE
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
                          <span className="text-[10px] text-amber-400 uppercase font-black">Score Recorder</span>
                          <span className="text-[10px] text-slate-500 uppercase font-mono">{match.round}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          {/* Home Score */}
                          <div className="w-1/3">
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">{match.homeTeamName}</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 font-mono text-center text-white"
                              value={homeScoreInput}
                              onChange={(e) => setHomeScoreInput(Number(e.target.value))}
                            />
                          </div>

                          <span className="text-slate-600 self-end py-1">VS</span>

                          {/* Away Score */}
                          <div className="w-1/3 text-right">
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1 text-right">{match.awayTeamName}</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 font-mono text-center text-white animate-none"
                              value={awayScoreInput}
                              onChange={(e) => setAwayScoreInput(Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Status</label>
                            <select
                              value={matchStatusInput}
                              onChange={(e) => setMatchStatusInput(e.target.value as any)}
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white"
                            >
                              <option value="upcoming">Upcoming</option>
                              <option value="live">Live Now</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Venue</label>
                            <input
                              type="text"
                              value={matchVenueInput}
                              onChange={(e) => setMatchVenueInput(e.target.value)}
                              className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white capitalize"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSaveMatchScore(match.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] uppercase cursor-pointer"
                          >
                            Save Metrics
                          </button>
                          <button
                            onClick={() => setEditingMatchId(null)}
                            className="border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] uppercase cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // RENDER FIXED METRICS
                      <div className="flex items-center justify-between gap-4">
                        <div className="w-1/3 truncate">
                          <span className="text-slate-200 font-bold block truncate">{match.homeTeamName}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold block">{match.score.homeScore} PTS</span>
                        </div>
                        
                        <div className="text-center font-bold">
                          <span className="text-[9px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-amber-400 inline-block mb-1">
                            {match.round}
                          </span>
                          <span className="text-[9px] uppercase tracking-wide block text-slate-500">
                            {match.status}
                          </span>
                        </div>

                        <div className="w-1/3 text-right truncate">
                          <span className="text-slate-200 font-bold block truncate">{match.awayTeamName}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold block">{match.score.awayScore} PTS</span>
                        </div>

                        <div className="shrink-0 pl-1 border-l border-slate-800">
                          <button
                            onClick={() => startEditMatch(match)}
                            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 p-2 rounded-lg cursor-pointer"
                          >
                            ✏️ Record Score
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="py-12 bg-slate-900/40 border border-slate-850 rounded-2xl text-center text-xs text-slate-500">
          Managed events queue is currently empty. Use "Host Tournament" at upper-right area to draft a tournament card.
        </div>
      )}

      {/* Host New Tournament Modal Overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-white">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-5.5 h-5.5 text-orange-500" /> Host New Sports Tournament
            </h3>
            
            <form onSubmit={handleCreateTournamentSubmission} className="space-y-4 text-left">
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
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Fixtures Formats *</label>
                  <select
                    value={newTourFormat}
                    onChange={(e) => setNewTourFormat(e.target.value as any)}
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
                disabled={creatingTournament}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {creatingTournament ? 'Publishing Arena...' : 'Assemble Arena'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
