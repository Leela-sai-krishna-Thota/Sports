/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Organizer' | 'Player';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  role: UserRole;
  createdAt: string;
}

export interface Sport {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  teamSize: number;
}

export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ScheduleType = 'round-robin' | 'knockout';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  sportId: string;
  status: TournamentStatus;
  scheduleType: ScheduleType;
  teamLimit: number;
  startDate: string;
  endDate: string;
  venue: string;
  creatorId: string;
  createdAt: string;
}

export type TeamStatus = 'pending' | 'approved' | 'rejected';

export interface Team {
  id: string;
  name: string;
  tournamentId: string;
  registeredBy: string; // userId of registrar
  status: TeamStatus;
  players: string[]; // member names
  logoUrl?: string;
  createdAt: string;
}

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface MatchScore {
  homeScore: number;
  awayScore: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  sportId: string;
  matchDate: string;
  venue: string;
  status: MatchStatus;
  round: string; // e.g. "Quarterfinals", "Round 1"
  score: MatchScore;
  winnerId?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
