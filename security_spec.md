# Security Specification & Threat Model
## Tournament Scheduler & Sports Management Platform

This document describes the security architecture, invariants, and threat definitions for the Firebase Firestore and Authentication modules.

### Data Invariants

1. **User Role Integrity**: No user may assign themselves the Admin (`role = 'Admin'`) or Organizer (`role = 'Organizer'`) role during signup. The default role for self-registration must be `Player` (or approved offline/via security checks).
2. **Relational Constraints**:
   - A `team` registration must belong to an existing `tournament` document. 
   - A `match` must reference valid existing teams for that tournament, and its `tournamentId` must refer to a valid `tournament`.
3. **Write Access Hierarchy**:
   - Admins can edit or delete anything.
   - Organizers can create tournaments, edit matches *only* for tournaments they created, and approve/reject team registrations for their tournaments.
   - Players can register teams to tournaments (as `status = 'pending'`), edit *only* their own profile, and read all fixtures, matching statuses, and standing boards.
4. **Workflow Invariants**:
   - Once a tournament is `completed`, its state, schedules, and scores are locked (Terminal State Locking) and cannot be updated unless by an Admin client.
   - Matches can transition from `scheduled` -> `live` -> `completed` (or `cancelled`), but once they are `completed`, score updates are immutable.

---

### The "Dirty Dozen" Threat Payloads

Here are twelve highly targeted JSON payloads designed to exploit vulnerabilities like identity spoofing, state-skipping, list-filtering bypasses, and resource poisoning:

#### 1. Identity Spoofing: Admin Role Hijacking
```json
// Path: /users/attacker-uid
// Payload Attempting to grant Admin role directly on signup
{
  "uid": "attacker-uid",
  "name": "Malicious User",
  "email": "attacker@gmail.com",
  "role": "Admin",
  "createdAt": "2026-05-27T14:56:47Z"
}
// EXPECTED BEHAVIOR: PARTIAL_DENIED / PERMISSION_DENIED. Role must be defaulted to 'Player' or validated.
```

#### 2. Self-Approved Registrar
```json
// Path: /tournaments/tourney-123/teams/team-attacker
// Payload: Attacker registers and attempts to approve their own registration instantly
{
  "id": "team-attacker",
  "name": "Shadow Team",
  "registeredBy": "attacker-uid",
  "status": "approved", 
  "tournamentId": "tourney-123"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Approval must require Creator of tourney-123.
```

#### 3. Match Injection: Non-Existent Teams
```json
// Path: /matches/forged-match-999
// Payload: Forger creates a match referencing non-existent teams.
{
  "id": "forged-match-999",
  "tournamentId": "tourney-123",
  "homeTeamId": "fake-team-1",
  "awayTeamId": "fake-team-2",
  "status": "live",
  "score": { "homeScore": 100, "awayScore": 0 }
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Ref validation constraints fail.
```

#### 4. Score Manipulation of Closed Matches (Terminal Shortcutting)
```json
// Path: /matches/match-456 (Status is already completed)
// Payload: Player attempts to change score after-the-fact
{
  "score": { "homeScore": 999, "awayScore": -5 },
  "winnerId": "attacker-team",
  "status": "completed"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED due to Immutable Status checks.
```

#### 5. Resource Poisoning: Massive Field Overflow
```json
// Path: /users/attacker-uid
// Payload: Attempting to poison server memory with 10MB string inside username
{
  "name": "[10MB long string of repetitive characters...]",
  "email": "attacker@gmail.com",
  "role": "Player"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Max string length check failed.
```

#### 6. Cross-User Dashboard Intrusion
```json
// Path: /notifications/someone-elses-notif
// Payload: User queries or attempts to delete someone else's notify token
{
  "userId": "victim-uid",
  "title": "You have been kicked",
  "read": true
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. User does not match auth.uid.
```

#### 7. Scheduling Conflict Forgery
```json
// Path: /tournaments/tourney-abc
// Payload: Competitor changes the date or invalidates a venue allocated to another sport
{
  "venue": "Poisoned Court A",
  "startDate": "1990-01-01"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Only tournament creator can update.
```

#### 8. Ghost Field Injection (The "Shadow Update" Test)
```json
// Path: /tournaments/tourney-123
// Payload: Attempting to sneak a system secret or shadow verified flag in
{
  "name": "Awesome Cricket Tourney",
  "isPlatformPremiumVerified": true, // Ghost field
  "teamLimit": 16
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Keys size or diff comparison controls prevent unauthorized fields.
```

#### 9. Unverified Email Writes
```json
// Path: /tournaments/tourney-new
// Payload: User with email_verified = false attempting critical state writes
{
  "name": "Spam League",
  "creatorId": "unverified-uid"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Requires request.auth.token.email_verified == true.
```

#### 10. Temporal Spoofing: Client-Generated Timestamps
```json
// Path: /tournaments/tourney-123
// Payload: Forcible override of creation dates with an ancient timestamp
{
  "createdAt": "2000-01-01T00:00:00Z"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Must strictly equal request.time.
```

#### 11. Anonymous Client Read Scraping (The PII Blanket Test)
```json
// Path: /users
// Operation: Anonymous list query fetch to dump user list
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Strict rule restricts direct collection-level dumps without where clauses or restricts entirely to authenticated profiles.
```

#### 12. Hostile Tournament Overwrites
```json
// Path: /tournaments/victim-tourney-789
// Payload: Attacker changes creatorId to lock-out real organizer
{
  "creatorId": "attacker-uid"
}
// EXPECTED BEHAVIOR: PERMISSION_DENIED. Creator ID matches must remain immutable.
