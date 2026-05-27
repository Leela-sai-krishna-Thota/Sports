/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Match, Team, Tournament } from '../types';

/**
 * Automagically generates Round-Robin fixtures for a list of approved teams.
 * Berger tables algorithm ensures that every team plays every other team once.
 */
export function generateRoundRobinFixtures(
  teams: Team[],
  tournament: Tournament,
  startHour: number = 9, // 9:00 AM matches
  minutesPerMatch: number = 90,
  venues: string[] = ['Court A', 'Court B']
): Omit<Match, 'updatedAt' | 'createdAt'>[] {
  if (teams.length < 2) return [];

  const list = [...teams];
  if (list.length % 2 !== 0) {
    // Add a placeholder dummy for Odd team count bypass
    list.push({
      id: 'BYE',
      name: 'BYE',
      tournamentId: tournament.id,
      registeredBy: '',
      status: 'approved',
      players: [],
      createdAt: ''
    });
  }

  const numTeams = list.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;
  const fixtures: Omit<Match, 'updatedAt' | 'createdAt'>[] = [];

  let matchDate = new Date(tournament.startDate);
  matchDate.setHours(startHour, 0, 0, 0);

  let currentVenueIndex = 0;

  for (let round = 0; round < numRounds; round++) {
    // Set match date to progress day-by-day or round-by-round
    const roundDate = new Date(matchDate);
    roundDate.setDate(roundDate.getDate() + round);

    for (let matchIdx = 0; matchIdx < matchesPerRound; matchIdx++) {
      const home = list[matchIdx];
      const away = list[numTeams - 1 - matchIdx];

      // Skip the fake match with BYE team
      if (home.id === 'BYE' || away.id === 'BYE') {
        continue;
      }

      // Distribute venue allocations
      const selectedVenue = venues[currentVenueIndex % venues.length] || tournament.venue || 'Main Stadium';
      currentVenueIndex++;

      // Adjust Match Hour within round day so matches happen in slots
      const playTime = new Date(roundDate);
      playTime.setMinutes(playTime.getMinutes() + matchIdx * minutesPerMatch);

      fixtures.push({
        id: `${tournament.id}-rr-${round}-${matchIdx}`,
        tournamentId: tournament.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        sportId: tournament.sportId,
        matchDate: playTime.toISOString(),
        venue: selectedVenue,
        status: 'upcoming',
        round: `Round ${round + 1}`,
        score: { homeScore: 0, awayScore: 0 }
      });
    }

    // Rotate teams using Round-Robin standard carousel
    const temp = list[1];
    for (let k = 1; k < numTeams - 1; k++) {
      list[k] = list[k + 1];
    }
    list[numTeams - 1] = temp;
  }

  return fixtures;
}

/**
 * Automagically generates Knockout elimination bracket fixtures.
 * Requires teams count to be formatted, otherwise fills empty spots with 'BYEs'.
 */
export function generateKnockoutFixtures(
  teams: Team[],
  tournament: Tournament,
  startHour: number = 10,
  venues: string[] = ['Main Court']
): Omit<Match, 'updatedAt' | 'createdAt'>[] {
  if (teams.length < 2) return [];

  // Determine standard bracket size (e.g., 2, 4, 8, 16, 32, 64)
  const count = teams.length;
  let bracketSize = 2;
  while (bracketSize < count) {
    bracketSize *= 2;
  }

  const fixtures: Omit<Match, 'updatedAt' | 'createdAt'>[] = [];
  let matchDate = new Date(tournament.startDate);
  matchDate.setHours(startHour, 0, 0, 0);

  // Round 1 label designation
  const roundLabel = `Round of ${bracketSize}`;

  // Build pairs for the starting round
  for (let i = 0; i < bracketSize / 2; i++) {
    const homeIdx = i * 2;
    const awayIdx = i * 2 + 1;

    const home = teams[homeIdx];
    const away = teams[awayIdx];

    // If no team is available, it becomes a bye to progress automatically
    if (!home) continue; // Full empty bracket slot skipped

    const homeId = home.id;
    const homeName = home.name;
    const awayId = away ? away.id : 'BYE';
    const awayName = away ? away.name : 'BYE';

    const playTime = new Date(matchDate);
    // Stagger match dates by index
    playTime.setHours(playTime.getHours() + Math.floor(i / venues.length) * 2);

    const selectedVenue = venues[i % venues.length] || tournament.venue || 'Main Court';

    fixtures.push({
      id: `${tournament.id}-ko-r1-${i}`,
      tournamentId: tournament.id,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeTeamName: homeName,
      awayTeamName: awayName,
      sportId: tournament.sportId,
      matchDate: playTime.toISOString(),
      venue: selectedVenue,
      status: awayId === 'BYE' ? 'completed' : 'upcoming', // BYE automatically completes for instant win progression
      round: roundLabel,
      score: { homeScore: awayId === 'BYE' ? 1 : 0, awayScore: 0 },
      winnerId: awayId === 'BYE' ? homeId : undefined
    });
  }

  return fixtures;
}
