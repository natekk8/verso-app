// ============================================================
// VERSO — Core TypeScript Types
// ============================================================

export type TournamentStatus = "draft" | "active" | "finished";
export type PhaseType = "group" | "bracket" | "single_match";
export type PhaseStatus = "pending" | "active" | "finished";
export type MatchStatus = "pending" | "in_progress" | "finished";
export type ScoringType = "standard" | "sets" | "custom";
export type TiebreakerRule = "head_to_head" | "score_diff" | "goals_scored";

// ─── Match Day ───────────────────────────────────────────────
export interface MatchDay {
  id: string;
  date: string;        // ISO date "2026-10-02"
  startTime?: string;  // "09:00"
  endTime?: string;    // "18:00"
  label?: string;      // optional custom label
}

// ─── Location ────────────────────────────────────────────────
export interface Location {
  id: string;
  name: string;
  order: number;
}

// ─── Scoring Config ──────────────────────────────────────────
export interface ScoringConfig {
  id: string;
  name: string;           // "Punktacja 1"
  type: ScoringType;
  winPoints: number;      // default 3
  drawPoints: number;     // default 1
  lossPoints: number;     // default 0
  tiebreakers: TiebreakerRule[];
  useSets: boolean;
}

// ─── Tournament ──────────────────────────────────────────────
export interface Tournament {
  _id: string;
  name: string;
  sport?: string;
  adminToken: string;     // secret token, stored in localStorage
  status: TournamentStatus;
  isOnline: boolean;
  matchDays: MatchDay[];
  locations: Location[];
  languages: string[];    // ["pl", "en"]
  scoring: ScoringConfig;
  publicPageEnabled: boolean;
  registrationEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Player ──────────────────────────────────────────────────
export interface Player {
  _id: string;
  tournamentId: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  customFields: Record<string, string>;
  playerToken: string;    // unique token for player link
  registrationStatus: "confirmed" | "pending" | "rejected";
  createdAt: number;
}

// ─── Phase ───────────────────────────────────────────────────
export interface Phase {
  _id: string;
  tournamentId: string;
  name: string;           // "Faza grupowa"
  type: PhaseType;
  order: number;
  status: PhaseStatus;
  advancingCount?: number; // how many advance to next phase
  matchDuration: number;  // minutes, default 45
}

// ─── Group ───────────────────────────────────────────────────
export interface Group {
  _id: string;
  phaseId: string;
  tournamentId: string;
  name: string;           // "Grupa A"
  playerIds: string[];    // includes null-ish BYE slots
  order: number;
}

// ─── Match ───────────────────────────────────────────────────
export interface Match {
  _id: string;
  tournamentId: string;
  phaseId: string;
  groupId?: string;       // null for bracket matches
  player1Id: string | null; // null = BYE
  player2Id: string | null;
  player1Score?: number;
  player2Score?: number;
  player1Sets?: number;
  player2Sets?: number;
  winnerId?: string | null; // null = draw
  round: number;          // round number (1-based)
  matchNumber: number;    // unique within phase (B1, B2...)
  matchLabel: string;     // "B1", "B2", "Finał"
  scheduledDayId?: string; // MatchDay.id
  scheduledTime?: string;  // "14:30"
  locationId?: string;
  duration?: number;      // override global
  status: MatchStatus;
  nextMatchId?: string;   // bracket: where winner goes
  nextMatchSlot?: 1 | 2;  // bracket: which slot (player1 or player2)
}

// ─── Standings Row ───────────────────────────────────────────
export interface StandingsRow {
  playerId: string;
  playerName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  position: number;
}

// ─── Registration Request ────────────────────────────────────
export interface RegistrationRequest {
  _id: string;
  tournamentId: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

// ─── Auth ────────────────────────────────────────────────────
export interface AdminSession {
  tournamentId: string;
  token: string;
}

// ─── Schedule Slot ───────────────────────────────────────────
export interface ScheduleSlot {
  time: string;           // "14:30"
  locationId: string;
  matchId?: string;
}

// ─── Convex API Response Types ───────────────────────────────
export type WithId<T> = T & { _id: string; _creationTime: number };
