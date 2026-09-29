/**
 * TypeScript Data Models & Contract Types for Verso Schema Architecture
 * 
 * Provides complete typings matching `schema.ts` for:
 * 1. Convex documents (Doc<"table"> shapes)
 * 2. In-memory / Offline Mock Store entities
 * 3. Engine-to-Database mapping adapters
 */

export type Id<TableName extends string> = string;

export interface TournamentDoc {
  _id: Id<"tournaments">;
  _creationTime: number;
  slug: string;
  name: string;
  adminSecret: string;
  sportRulesId: Id<"sportRules">;
  allowPlayerScoreSubmission: boolean;
  refereeSecret?: string;
  description?: string;
  status?: "draft" | "in_progress" | "completed";
  createdAt: number;
}

export interface SportRulesDoc {
  _id: Id<"sportRules">;
  _creationTime: number;
  tournamentId?: Id<"tournaments">;
  preset: "table_tennis" | "padel" | "football" | "esport" | "custom";
  singularUnit: string;
  pluralUnit: string;
  targetPointsPerUnit: number;
  unitsToWinMatch: number;
  hasDeciderTiebreak: boolean;
  deciderThreshold: number;
  deciderPoints: number;
  winByTwo: boolean;
  pointsRule: "2_1_matrix" | "standard_3_1_0";
}

export interface DayDoc {
  _id: Id<"days">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  date: string; // "YYYY-MM-DD"
  order: number;
  startTime?: string; // "HH:MM"
  endTime?: string;
  maxMatches?: number;
}

export interface PitchDoc {
  _id: Id<"pitches">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  name: string;
  order: number;
  refereeSecret?: string;
  notes?: string;
}

export interface StageDoc {
  _id: Id<"stages">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  name: string;
  type: "group" | "knockout";
  order: number;
  status?: "pending" | "in_progress" | "completed";
}

export interface GroupDoc {
  _id: Id<"groups">;
  _creationTime: number;
  stageId: Id<"stages">;
  tournamentId: Id<"tournaments">;
  name: string;
  order?: number;
}

export interface PlayerDoc {
  _id: Id<"players">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  name: string;
  secretCode: string;
  groupSlotIndex?: number; // 0 to N-1
  stageId?: Id<"stages">;
  groupId?: Id<"groups">;
  checkedIn: boolean;
  seed?: number;
  notes?: string;
  createdAt?: number;
}

export type MatchStatus = "pending" | "in_progress" | "completed";
export type KnockoutRoundName =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "third_place"
  | "final";

export interface MatchSetScore {
  s1: number;
  s2: number;
}

export interface KnockoutSlotSource {
  sourceType: "group_rank" | "winner_of" | "loser_of" | "seed";
  sourceRef: string; // e.g. "1. Grupa A", "sf-1"
}

export interface MatchDoc {
  _id: Id<"matches">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  stageId: Id<"stages">;
  groupId?: Id<"groups">;
  dayId?: Id<"days">;
  pitchId?: Id<"pitches">;
  time?: string;
  endTime?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  roundNumber: number;
  matchInRound?: number;
  roundName?: KnockoutRoundName;
  player1Id?: Id<"players">;
  player2Id?: Id<"players">;
  player1Slot?: number;
  player2Slot?: number;
  slot1Source?: KnockoutSlotSource;
  slot2Source?: KnockoutSlotSource;
  knockoutMatchId?: string;
  isBye?: boolean;
  sets: MatchSetScore[];
  status: MatchStatus;
  winnerId?: Id<"players">;
  loserId?: Id<"players">;
  walkover?: boolean;
  walkoverWinnerId?: Id<"players">;
  scoreSubmittedBy?: string;
  updatedAt?: number;
}

export interface QualificationRuleDoc {
  _id: Id<"qualificationRules">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  sourceGroupId: Id<"groups">;
  sourceRank: number;
  targetMatchId: Id<"matches">;
  targetSlot: "slot1" | "slot2";
  description?: string;
}

export type SlideType = "standings" | "matches" | "announcement" | "announcements";

export interface SlideConfigDoc {
  _id: Id<"slides">;
  _creationTime: number;
  tournamentId: Id<"tournaments">;
  rotationIntervalSeconds: number;
  announcementText?: string;
  activeSlides: SlideType[];
  autoScrollSpeed?: number;
  theme?: string;
  updatedAt?: number;
}

/**
 * Composite Database Snapshot representing the complete state of a tournament.
 */
export interface TournamentDatabaseSnapshot {
  tournament: TournamentDoc;
  sportRules: SportRulesDoc;
  days: DayDoc[];
  pitches: PitchDoc[];
  stages: StageDoc[];
  groups: GroupDoc[];
  players: PlayerDoc[];
  matches: MatchDoc[];
  qualificationRules: QualificationRuleDoc[];
  slides: SlideConfigDoc;
}
