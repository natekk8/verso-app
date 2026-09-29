import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Verso Convex Database Schema Architecture
 * 
 * Defines the 10 reactive tables required for the Verso Tournament Management Platform:
 * 1. tournaments - Root tournament aggregate with passwordless secrets and permission toggles
 * 2. sportRules - Dynamic sport terminology, win conditions, and scoring matrix rules
 * 3. days - Multi-day tournament schedule calendar
 * 4. pitches - Table/field/court venue resources with ordering
 * 5. stages - Tournament phases (group stage, knockout stage, playoff)
 * 6. groups - Stage subdivisions (e.g. Grupa A)
 * 7. players - Tournament participants with personalized secret codes and slot indexing
 * 8. matches - Round-robin and knockout fixtures, sets scoring, status, and pitch allocation
 * 9. qualificationRules - DAG routing graph mapping group standings ranks to playoff bracket slots
 * 10. slides - Big-screen venue presentation kiosk configuration
 */

export default defineSchema({
  // 1. Tournaments: Primary Aggregate Root
  tournaments: defineTable({
    slug: v.string(), // Unique human-readable URL slug, e.g. "mistrzostwa-1v1-fss"
    name: v.string(), // Tournament title, e.g. "Mistrzostwa 1v1 FSS"
    adminSecret: v.string(), // High-entropy secret token for organizer admin hub
    sportRulesId: v.id("sportRules"), // Reference to active sport rules configuration
    allowPlayerScoreSubmission: v.boolean(), // Permission toggle: whether players can submit/verify match scores
    refereeSecret: v.optional(v.string()), // Optional tournament-wide referee access token
    description: v.optional(v.string()), // Optional description / venue information
    status: v.optional(
      v.union(v.literal("draft"), v.literal("in_progress"), v.literal("completed"))
    ),
    createdAt: v.number(), // Epoch ms timestamp
  })
    .index("by_slug", ["slug"])
    .index("by_admin_secret", ["adminSecret"])
    .index("by_slug_and_adminSecret", ["slug", "adminSecret"])
    .index("by_referee_secret", ["refereeSecret"]),

  // 2. Sport Rules: Dynamic Scoring & Unit Terminology
  sportRules: defineTable({
    tournamentId: v.optional(v.id("tournaments")), // Optional scoping to a specific tournament
    preset: v.union(
      v.literal("table_tennis"),
      v.literal("padel"),
      v.literal("football"),
      v.literal("esport"),
      v.literal("custom")
    ),
    singularUnit: v.string(), // e.g. "Set", "Głowa", "Gem", "Połowa"
    pluralUnit: v.string(), // e.g. "Sety", "Głowy", "Gemy", "Połowy"
    targetPointsPerUnit: v.number(), // Points to win unit (e.g. 11, 21, 6, 1)
    unitsToWinMatch: v.number(), // Units to win match (e.g. 2 for best-of-3)
    hasDeciderTiebreak: v.boolean(), // Whether tiebreak set is played at threshold
    deciderThreshold: v.number(), // Unit score threshold when decider triggers (e.g. 1 for 1:1)
    deciderPoints: v.number(), // Decider target points (e.g. 15)
    winByTwo: v.boolean(), // Win-by-2 margin requirement toggle
    pointsRule: v.union(v.literal("2_1_matrix"), v.literal("standard_3_1_0")), // Standings point calculation rule
  }).index("by_tournament", ["tournamentId"]),

  // 3. Days: Multi-Day Calendar
  days: defineTable({
    tournamentId: v.id("tournaments"),
    date: v.string(), // ISO date "YYYY-MM-DD" (e.g. "2026-10-02")
    order: v.number(), // Chronological display order (1, 2, 3...)
    startTime: v.optional(v.string()), // Daily start time "HH:MM" (e.g. "18:00")
    endTime: v.optional(v.string()), // Daily end time "HH:MM"
    maxMatches: v.optional(v.number()), // Daily scheduling match quota
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_tournament_order", ["tournamentId", "order"])
    .index("by_tournament_date", ["tournamentId", "date"]),

  // 4. Pitches: Venue Playing Locations
  pitches: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(), // Pitch/Table/Court label (e.g. "Stół 1", "Stół 2")
    order: v.number(), // Allocation order (1, 2...)
    refereeSecret: v.optional(v.string()), // Pitch-specific referee secret code
    notes: v.optional(v.string()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_tournament_order", ["tournamentId", "order"])
    .index("by_referee_secret", ["refereeSecret"]),

  // 5. Stages: Multi-Stage Structure
  stages: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(), // Stage name (e.g. "Grupa A", "Drabinka B", "Faza Finałowa")
    type: v.union(v.literal("group"), v.literal("knockout")),
    order: v.number(), // Stage progression order (1, 2...)
    status: v.optional(
      v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"))
    ),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_tournament_order", ["tournamentId", "order"])
    .index("by_tournament_type", ["tournamentId", "type"]),

  // 6. Groups: Stage Subdivisions
  groups: defineTable({
    stageId: v.id("stages"),
    tournamentId: v.id("tournaments"), // Denormalized for direct tournament queries
    name: v.string(), // Group title (e.g. "Grupa A")
    order: v.optional(v.number()), // Group ordering within stage
  })
    .index("by_stage", ["stageId"])
    .index("by_tournament", ["tournamentId"])
    .index("by_stage_name", ["stageId", "name"]),

  // 7. Players: Tournament Participants
  players: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(), // Participant name (e.g. "Tomasz Borówka")
    secretCode: v.string(), // Personalized private link token (/[slug]/p/[playerSecret])
    groupSlotIndex: v.optional(v.number()), // Berger slot index (0 to N-1; e.g. slot 8 for Tomasz Borówka)
    stageId: v.optional(v.id("stages")), // Initial stage assignment
    groupId: v.optional(v.id("groups")), // Initial group assignment
    checkedIn: v.boolean(), // Check-in status toggle
    seed: v.optional(v.number()), // Initial seed rank
    notes: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_secret", ["secretCode"])
    .index("by_tournament_and_secret", ["tournamentId", "secretCode"])
    .index("by_tournament_and_slot", ["tournamentId", "groupSlotIndex"])
    .index("by_group", ["groupId"]),

  // 8. Matches: Fixtures, Schedule & Scores
  matches: defineTable({
    tournamentId: v.id("tournaments"),
    stageId: v.id("stages"),
    groupId: v.optional(v.id("groups")), // Undefined for knockout matches
    dayId: v.optional(v.id("days")), // Scheduled day
    pitchId: v.optional(v.id("pitches")), // Scheduled pitch
    time: v.optional(v.string()), // Match start time "HH:MM"
    endTime: v.optional(v.string()), // Match end time "HH:MM"
    startTimestamp: v.optional(v.number()), // Epoch ms for countdown timer
    endTimestamp: v.optional(v.number()), // Epoch ms
    roundNumber: v.number(), // Round number (1-indexed)
    matchInRound: v.optional(v.number()), // Match index within round (1-indexed)
    roundName: v.optional(
      v.union(
        v.literal("round_of_32"),
        v.literal("round_of_16"),
        v.literal("quarterfinals"),
        v.literal("semifinals"),
        v.literal("third_place"),
        v.literal("final")
      )
    ),
    player1Id: v.optional(v.id("players")), // Empty if waiting for seeding/qualifiers
    player2Id: v.optional(v.id("players")),
    player1Slot: v.optional(v.number()), // Berger slot index
    player2Slot: v.optional(v.number()),
    // Knockout DAG Slot References
    slot1Source: v.optional(
      v.object({
        sourceType: v.string(), // "group_rank" | "winner_of" | "loser_of" | "seed"
        sourceRef: v.string(), // e.g. "1. Grupa A", "sf-1"
      })
    ),
    slot2Source: v.optional(
      v.object({
        sourceType: v.string(),
        sourceRef: v.string(),
      })
    ),
    knockoutMatchId: v.optional(v.string()), // Symbolic match identifier e.g. "sf-1", "third-place", "final"
    isBye: v.optional(v.boolean()), // Virtual round-robin bye indicator
    sets: v.array(
      v.object({
        s1: v.number(),
        s2: v.number(),
      })
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    winnerId: v.optional(v.id("players")),
    loserId: v.optional(v.id("players")), // For loser propagation to 3rd place match
    walkover: v.optional(v.boolean()), // Walkover flag
    walkoverWinnerId: v.optional(v.id("players")),
    scoreSubmittedBy: v.optional(v.string()), // "admin", "referee", or playerId
    updatedAt: v.optional(v.number()), // Epoch ms of last modification
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_stage", ["stageId"])
    .index("by_group", ["groupId"])
    .index("by_day", ["dayId"])
    .index("by_pitch", ["pitchId"])
    .index("by_player1", ["player1Id"])
    .index("by_player2", ["player2Id"])
    .index("by_tournament_day", ["tournamentId", "dayId"])
    .index("by_tournament_stage", ["tournamentId", "stageId"])
    .index("by_tournament_status", ["tournamentId", "status"])
    .index("by_tournament_round", ["tournamentId", "roundNumber"]),

  // 9. Qualification Rules: DAG Seeding Routing Graph
  qualificationRules: defineTable({
    tournamentId: v.id("tournaments"),
    sourceGroupId: v.id("groups"), // Source group producing qualifier
    sourceRank: v.number(), // Qualifying rank (1, 2, 3, 4...)
    targetMatchId: v.id("matches"), // Target playoff match
    targetSlot: v.union(v.literal("slot1"), v.literal("slot2")), // Target slot in match
    description: v.optional(v.string()), // E.g. "1. Grupa A -> Semifinal 1 (Slot 1)"
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_source_group", ["sourceGroupId"])
    .index("by_target_match", ["targetMatchId"])
    .index("by_source", ["sourceGroupId", "sourceRank"]),

  // 10. Slides: Venue TV Presentation Kiosk
  slides: defineTable({
    tournamentId: v.id("tournaments"),
    rotationIntervalSeconds: v.number(), // Default 10 seconds
    announcementText: v.optional(v.string()), // Ticker / bulletin text
    activeSlides: v.array(
      v.union(
        v.literal("standings"),
        v.literal("matches"),
        v.literal("announcements"),
        v.literal("announcement")
      )
    ),
    autoScrollSpeed: v.optional(v.number()), // Kiosk scroll pacing
    theme: v.optional(v.string()), // Optional styling theme
    updatedAt: v.optional(v.number()),
  }).index("by_tournament", ["tournamentId"]),
});
