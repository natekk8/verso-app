import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Tournaments ─────────────────────────────────────────────
  tournaments: defineTable({
    name: v.string(),
    sport: v.optional(v.string()),
    adminToken: v.string(), // secret, only admin knows this
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("finished")),
    isOnline: v.boolean(),

    // Match days
    matchDays: v.array(
      v.object({
        id: v.string(),
        date: v.string(), // ISO "2026-10-02"
        startTime: v.optional(v.string()), // "09:00"
        endTime: v.optional(v.string()),   // "18:00"
        label: v.optional(v.string()),
      })
    ),

    // Locations / courts / tables
    locations: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        order: v.number(),
      })
    ),

    languages: v.array(v.string()), // ["pl", "en"]

    // Scoring config
    scoring: v.object({
      id: v.string(),
      name: v.string(),
      type: v.union(v.literal("standard"), v.literal("sets"), v.literal("custom")),
      winPoints: v.number(),
      drawPoints: v.number(),
      lossPoints: v.number(),
      tiebreakers: v.array(
        v.union(
          v.literal("head_to_head"),
          v.literal("score_diff"),
          v.literal("goals_scored")
        )
      ),
      useSets: v.boolean(),
    }),

    publicPageEnabled: v.boolean(),
    registrationEnabled: v.boolean(),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  // ─── Players ──────────────────────────────────────────────────
  players: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    customFields: v.record(v.string(), v.string()),
    playerToken: v.string(), // unique token for player's personal link
    registrationStatus: v.union(
      v.literal("confirmed"),
      v.literal("pending"),
      v.literal("rejected")
    ),
    order: v.number(), // display order
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_player_token", ["playerToken"]),

  // ─── Phases ───────────────────────────────────────────────────
  phases: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(), // "Faza grupowa", "Faza pucharowa"
    type: v.union(
      v.literal("group"),
      v.literal("bracket"),
      v.literal("single_match")
    ),
    order: v.number(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("finished")),
    advancingCount: v.optional(v.number()), // how many advance to next phase
    matchDuration: v.number(), // minutes, default 45
  }).index("by_tournament", ["tournamentId"]),

  // ─── Groups (within a group phase) ───────────────────────────
  groups: defineTable({
    phaseId: v.id("phases"),
    tournamentId: v.id("tournaments"),
    name: v.string(), // "Grupa A"
    playerIds: v.array(v.union(v.id("players"), v.null())), // null = BYE
    order: v.number(),
  })
    .index("by_phase", ["phaseId"])
    .index("by_tournament", ["tournamentId"]),

  // ─── Matches ──────────────────────────────────────────────────
  matches: defineTable({
    tournamentId: v.id("tournaments"),
    phaseId: v.id("phases"),
    groupId: v.optional(v.id("groups")), // null for bracket matches
    player1Id: v.union(v.id("players"), v.null()), // null = BYE
    player2Id: v.union(v.id("players"), v.null()),
    player1Score: v.optional(v.number()),
    player2Score: v.optional(v.number()),
    player1Sets: v.optional(v.number()),
    player2Sets: v.optional(v.number()),
      setsDetails: v.optional(v.array(v.object({ p1: v.number(), p2: v.number() }))),
    winnerId: v.optional(v.union(v.id("players"), v.null())), // null = draw
    round: v.number(), // round number (1-based)
    matchNumber: v.number(), // unique within phase
    matchLabel: v.string(), // "B1", "Finał", "Półfinał 1"
    scheduledDayId: v.optional(v.string()), // MatchDay.id
    scheduledTime: v.optional(v.string()), // "14:30"
    locationId: v.optional(v.string()),
    duration: v.optional(v.number()), // override global
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("finished")
    ),
    // Bracket progression
    nextMatchId: v.optional(v.id("matches")),
    nextMatchSlot: v.optional(v.union(v.literal(1), v.literal(2))),
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_phase", ["phaseId"])
    .index("by_group", ["groupId"])
    .index("by_schedule", ["tournamentId", "scheduledDayId"]),

  // ─── Registration Requests ────────────────────────────────────
  registrations: defineTable({
    tournamentId: v.id("tournaments"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  }).index("by_tournament", ["tournamentId"]),
});
