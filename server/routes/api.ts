/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import admin from 'firebase-admin';
import { AuthRequest, verifyFirebaseToken, getAdminApp, getFirestoreDb } from '../middleware/auth';
import { generateRoundRobinFixtures, generateKnockoutFixtures } from '../../src/utils/scheduler';
import { Tournament, Team, Match } from '../../src/types';

const router = Router();

// 1. Dynamic Sports Seeding & Catalog
router.get('/sports', (req, res) => {
  const defaultSports = [
    {
      id: 'cricket',
      name: 'Cricket',
      description: 'A gentleman\'s game of strategy, batting battles, and dramatic run-chases.',
      icon: 'Flame',
      image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeGVrrQpDBiZXUbwxEO3H-uWZy4NRp2rWHAg&s',
      teamSize: 11
    },
    {
      id: 'football',
      name: 'Football (Soccer)',
      description: 'High-octane excitement, global rivalries, tactical formations, and stunning spectacular goals.',
      icon: 'Trophy',
      image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTX4pCdm-Mjfgc7-KIY4Ua-14ajPpHjoUm4_w&s',
      teamSize: 11
    },
    {
      id: 'basketball',
      name: 'Basketball',
      description: 'Fast-paced courtside rhythm, high-flying slam dunks, and strategic three-pointers.',
      icon: 'Target',
      image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&q=80&w=600',
      teamSize: 5
    },
    {
      id: 'volleyball',
      name: 'Volleyball',
      description: 'Intense spike rallies, layout digs, and exceptional tactical team coordination.',
      icon: 'Activity',
      image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG36OGcdhZqaswCnIsvm3cEfzW7QrJTOFgyg&s',
      teamSize: 6
    },
    {
      id: 'badminton',
      name: 'Badminton',
      description: 'Lightning-fast overhead smashes, drop shots, and thrilling racket speed duels.',
      icon: 'Zap',
      image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=600',
      teamSize: 2
    },
    {
      id: 'kabaddi',
      name: 'Kabaddi',
      description: 'An ancient tactical breath-holding contact sport of raiding and defensive holds.',
      icon: 'Shield',
      image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTJNgt4qTL5mNQeY2tF34om6e9bGqGjNOpTQ&s',
      teamSize: 7
    }
  ];
  return res.json(defaultSports);
});

// 2. Automated Bracket Schedule Generator
router.post('/tournaments/:id/schedule', verifyFirebaseToken, async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const db = getFirestoreDb();

    // Fetch tournament
    const tourDoc = await db.collection('tournaments').doc(id).get();
    if (!tourDoc.exists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = tourDoc.data() as Tournament;

    // Verify ownership
    if (tournament.creatorId !== req.user?.uid && req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden: Only the tournament organizer can generate fixtures' });
    }

    // Fetch all APPROVED teams
    const teamsSnap = await db.collection('teams')
      .where('tournamentId', '==', id)
      .where('status', '==', 'approved')
      .get();
    
    const approvedTeams = teamsSnap.docs.map(doc => doc.data() as Team);
    if (approvedTeams.length < 2) {
      return res.status(400).json({ error: 'Cannot generate fixtures. Minimum of 2 approved teams required.' });
    }

    // Clear any existing matches for clean slate
    const existingMatchesSnap = await db.collection('matches')
      .where('tournamentId', '==', id)
      .get();
    
    const deleteBatch = db.batch();
    existingMatchesSnap.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    // Generate matches based on format
    let matches: Omit<Match, 'updatedAt' | 'createdAt'>[] = [];
    if (tournament.scheduleType === 'round-robin') {
      matches = generateRoundRobinFixtures(approvedTeams, tournament);
    } else {
      matches = generateKnockoutFixtures(approvedTeams, tournament);
    }

    // Bulk save generated matches to Firestore
    const saveBatch = db.batch();
    const now = new Date().toISOString();

    matches.forEach(m => {
      const docRef = db.collection('matches').doc(m.id);
      saveBatch.set(docRef, {
        ...m,
        createdAt: now,
        updatedAt: now
      });
    });

    // Update tournament status to active
    const tournamentRef = db.collection('tournaments').doc(id);
    saveBatch.update(tournamentRef, { status: 'active' });

    await saveBatch.commit();

    return res.status(200).json({ 
      message: `Successfully generated ${matches.length} matches!`,
      matchesCount: matches.length
    });
  } catch (error: any) {
    console.error('Fixture Generation Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Admin & Organizer Registration Controls
router.patch('/teams/:id/status', verifyFirebaseToken, async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status update command' });
  }

  try {
    const db = getFirestoreDb();

    const teamDoc = await db.collection('teams').doc(id).get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: 'Team registration not found' });
    }
    const team = teamDoc.data() as Team;

    // Fetch tournament to confirm creator matching
    const tourDoc = await db.collection('tournaments').doc(team.tournamentId).get();
    if (!tourDoc.exists) {
      return res.status(404).json({ error: 'Associated tournament not found' });
    }
    const tournament = tourDoc.data() as Tournament;

    // Verify administrative rights
    if (tournament.creatorId !== req.user?.uid && req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden: Only the tournament organizer can review teams' });
    }

    // Write approval change
    await db.collection('teams').doc(id).update({ status });

    // Send instant system notification alert to the registering captain
    const notificationId = `notif-${Date.now()}`;
    await db.collection('notifications').doc(notificationId).set({
      id: notificationId,
      userId: team.registeredBy,
      title: status === 'approved' ? 'Team Approved!' : 'Registration Update',
      message: `Your team "${team.name}" has been ${status} for tournament "${tournament.name}".`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, status });
  } catch (error: any) {
    console.error('Team Action Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Analytics Counter Dashboard Endpoints
router.get('/admin/analytics', verifyFirebaseToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const db = getFirestoreDb();

    // High fidelity counters
    const usersSnap = await db.collection('users').get();
    const tournamentsSnap = await db.collection('tournaments').get();
    const teamsSnap = await db.collection('teams').get();
    const matchesSnap = await db.collection('matches').get();

    const totalUsers = usersSnap.size;
    const totalTournaments = tournamentsSnap.size;
    const totalTeams = teamsSnap.size;
    
    let activeMatches = 0;
    let completedMatches = 0;
    
    matchesSnap.forEach((doc) => {
      const match = doc.data() as Match;
      if (match.status === 'live' || match.status === 'upcoming') {
        activeMatches++;
      } else if (match.status === 'completed') {
        completedMatches++;
      }
    });

    // Sports split statistics aggregation
    const sportsSplit: { [key: string]: number } = {};
    tournamentsSnap.forEach(doc => {
      const tour = doc.data() as Tournament;
      sportsSplit[tour.sportId] = (sportsSplit[tour.sportId] || 0) + 1;
    });

    const rolesSplit = { Admin: 0, Organizer: 0, Player: 0 };
    usersSnap.forEach(doc => {
      const user = doc.data();
      if (user.role === 'Admin') rolesSplit.Admin++;
      else if (user.role === 'Organizer') rolesSplit.Organizer++;
      else rolesSplit.Player++;
    });

    return res.json({
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
  } catch (error: any) {
    console.error('Analytics aggregation failed:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Seeding Demo Tournaments Endpoint
router.post('/admin/seed-demo', verifyFirebaseToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const db = getFirestoreDb();
    const creatorId = req.user?.uid || 'system';

    const defaultTournaments = [
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
        description: 'Fast-paced courtside rhythm, high-flying slam dunks, and strategic three-pointers with professional crews.',
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

    const batch = db.batch();
    defaultTournaments.forEach((tour) => {
      const docRef = db.collection('tournaments').doc(tour.id);
      batch.set(docRef, {
        ...tour,
        creatorId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    return res.status(200).json({ success: true, message: 'All 6 demo tournaments seeded successfully!' });
  } catch (error: any) {
    console.error('Demo seeding failed:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
