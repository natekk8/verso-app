import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { generateBergerSchedule } from "../src/engine/berger";
import {
  scheduleTournamentMatches,
  MatchInput,
  PitchConfig,
  DayConfig,
} from "../src/engine/scheduler";
import { validateMatchScore } from "../src/engine/scoring";
import { generateKnockoutBracket } from "../src/engine/knockout";

// 1. LIST MATCHES BY TOURNAMENT (Enriched with player, pitch, and day metadata)
export const listByTournament = query({
  args: {
    tournamentId: v.id("tournaments"),
    stageId: v.optional(v.id("stages")),
    groupId: v.optional(v.id("groups")),
    dayId: v.optional(v.id("days")),
    adminSecret: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    let matches = await ctx.db
      .query("matches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();

    if (args.stageId) matches = matches.filter((m: any) => m.stageId === args.stageId);
    if (args.groupId) matches = matches.filter((m: any) => m.groupId === args.groupId);
    if (args.dayId) matches = matches.filter((m: any) => m.dayId === args.dayId);

    let isAdmin = false;
    if (args.adminSecret) {
      const tournament = await ctx.db.get(args.tournamentId);
      isAdmin = Boolean(tournament && tournament.adminSecret === args.adminSecret);
    }

    // Batch enrich player names, pitches, days
    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();

    const sanitizePlayer = (p: any) => {
      if (!p) return undefined;
      if (isAdmin) return p;
      const { secretCode, ...safePlayer } = p;
      return safePlayer;
    };

    const playerMap = new Map(players.map((p: any) => [p._id, sanitizePlayer(p)]));

    const pitches = await ctx.db
      .query("pitches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const pitchMap = new Map(pitches.map((p: any) => [p._id, p]));

    const days = await ctx.db
      .query("days")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const dayMap = new Map(days.map((d: any) => [d._id, d]));

    return matches.map((m: any) => ({
      ...m,
      player1: m.player1Id ? playerMap.get(m.player1Id) : undefined,
      player2: m.player2Id ? playerMap.get(m.player2Id) : undefined,
      pitch: m.pitchId ? pitchMap.get(m.pitchId) : undefined,
      day: m.dayId ? dayMap.get(m.dayId) : undefined,
    }));
  },
});

// 2. GENERATE MATCHES FROM BERGER SCHEDULE & PITCH SCHEDULER
export const generateFromSchedule = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    stageId: v.id("stages"),
    groupId: v.id("groups"),
    autoSchedulePitchesAndTime: v.optional(v.boolean()),
    matchDurationMinutes: v.optional(v.number()),
    restIntervalMinutes: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    players.sort((a: any, b: any) => (a.groupSlotIndex ?? 0) - (b.groupSlotIndex ?? 0));

    if (players.length < 2) {
      throw new ConvexError("Cannot generate Berger schedule with fewer than 2 players.");
    }

    // Call Berger Engine
    const bergerRounds = generateBergerSchedule(players.length);

    // Delete existing uncompleted matches in this group
    const existingMatches = await ctx.db
      .query("matches")
      .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
      .collect();
    for (const em of existingMatches) {
      if (em.status !== "completed") {
        await ctx.db.delete(em._id);
      }
    }

    // Prepare raw matches array
    const rawMatches: { round: number; p1Id: any; p2Id: any; p1Slot: number; p2Slot: number }[] = [];
    for (const r of bergerRounds) {
      for (const m of r.matches) {
        if (!m.isBye) {
          rawMatches.push({
            round: r.roundNumber,
            p1Id: players[m.player1Slot]._id,
            p2Id: players[m.player2Slot]._id,
            p1Slot: m.player1Slot,
            p2Slot: m.player2Slot,
          });
        }
      }
    }

    const autoSchedule = args.autoSchedulePitchesAndTime ?? true;
    let scheduledAssignments: any[] = [];

    if (autoSchedule) {
      const pitches = await ctx.db
        .query("pitches")
        .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
        .collect();
      pitches.sort((a: any, b: any) => a.order - b.order);

      const days = await ctx.db
        .query("days")
        .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
        .collect();
      days.sort((a: any, b: any) => a.order - b.order);

      if (pitches.length > 0 && days.length > 0) {
        const matchInputs: MatchInput[] = rawMatches.map((m, idx) => ({
          id: `match-${idx}`,
          round: m.round,
          player1Id: m.p1Id,
          player2Id: m.p2Id,
          stageId: args.stageId,
          groupId: args.groupId,
        }));

        const pitchConfigs: PitchConfig[] = pitches.map((p: any) => ({
          id: p._id,
          name: p.name,
          order: p.order,
        }));

        const dayConfigs: DayConfig[] = days.map((d: any) => ({
          id: d._id,
          date: d.date,
          startTime: d.startTime || "18:00",
        }));

        scheduledAssignments = scheduleTournamentMatches(matchInputs, pitchConfigs, dayConfigs, {
          matchDurationMinutes: args.matchDurationMinutes ?? 20,
          restIntervalMinutes: args.restIntervalMinutes ?? 10,
        });
      }
    }

    // Insert scheduled or raw matches
    const insertedIds: any[] = [];
    for (let i = 0; i < rawMatches.length; i++) {
      const raw = rawMatches[i];
      const sched = scheduledAssignments[i];

      const matchDoc: any = {
        tournamentId: args.tournamentId,
        stageId: args.stageId,
        groupId: args.groupId,
        roundNumber: raw.round,
        player1Id: raw.p1Id,
        player2Id: raw.p2Id,
        player1Slot: raw.p1Slot,
        player2Slot: raw.p2Slot,
        sets: [],
        status: "pending",
      };

      if (sched) {
        matchDoc.dayId = sched.dayId;
        matchDoc.pitchId = sched.pitchId;
        matchDoc.time = sched.startTime;
        matchDoc.endTime = sched.endTime;
        matchDoc.startTimestamp = sched.startTimestamp;
        matchDoc.endTimestamp = sched.endTimestamp;
      }

      const id = await ctx.db.insert("matches", matchDoc);
      insertedIds.push(id);
    }

    return {
      generatedCount: insertedIds.length,
      roundsCount: bergerRounds.length,
    };
  },
});

async function verifyAdminOrReferee(
  ctx: any,
  tournament: any,
  adminSecret?: string,
  refereeSecret?: string
): Promise<{ isAdmin: boolean; isReferee: boolean }> {
  const isAdmin = Boolean(adminSecret && adminSecret === tournament.adminSecret);

  let isReferee = false;
  if (refereeSecret && refereeSecret.length > 0) {
    if (tournament.refereeSecret && refereeSecret === tournament.refereeSecret) {
      isReferee = true;
    } else {
      const pitches = await ctx.db
        .query("pitches")
        .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
        .collect();
      isReferee = pitches.some(
        (p: any) => p.refereeSecret && p.refereeSecret === refereeSecret
      );
    }
  }

  if (!isAdmin && !isReferee) {
    throw new ConvexError("Unauthorized: Requires Admin or Referee authorization");
  }

  return { isAdmin, isReferee };
}

// 3. UPDATE SCORE (Admin / Referee authority)
export const updateScore = mutation({
  args: {
    matchId: v.id("matches"),
    adminSecret: v.optional(v.string()),
    refereeSecret: v.optional(v.string()),
    sets: v.array(v.object({ s1: v.number(), s2: v.number() })),
  },
  handler: async (ctx: any, args: any) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new ConvexError("Match not found");

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament) throw new ConvexError("Tournament not found");

    const { isAdmin } = await verifyAdminOrReferee(
      ctx,
      tournament,
      args.adminSecret,
      args.refereeSecret
    );

    const sportRules = await ctx.db.get(tournament.sportRulesId);
    if (!sportRules) throw new ConvexError("Sport rules not found");

    // Engine Validation
    const validation = validateMatchScore(args.sets, sportRules as any);
    if (!validation.isValid) {
      throw new ConvexError(validation.error || "Invalid score submission");
    }

    let status: "pending" | "in_progress" | "completed" = "pending";
    let winnerId: any = undefined;

    if (validation.isMatchCompleted) {
      status = "completed";
      winnerId = validation.winner === 1 ? match.player1Id : match.player2Id;
    } else if (args.sets.length > 0) {
      status = "in_progress";
    }

    await ctx.db.patch(args.matchId, {
      sets: args.sets,
      status,
      winnerId,
      walkover: false,
      scoreSubmittedBy: isAdmin ? "admin" : "referee",
      updatedAt: Date.now(),
    });

    // Knockout progression: advance winner/loser if applicable
    if (status === "completed" && winnerId) {
      const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
      await propagateKnockoutResultInDb(ctx, match.tournamentId, args.matchId, winnerId, loserId);
    }

    return {
      success: true,
      status,
      winnerId,
      setsWonP1: validation.setsWonP1,
      setsWonP2: validation.setsWonP2,
    };
  },
});

// 4. SUBMIT PLAYER SCORE (Permission Gate Enforced)
export const submitPlayerScore = mutation({
  args: {
    matchId: v.id("matches"),
    playerSecret: v.string(),
    sets: v.array(v.object({ s1: v.number(), s2: v.number() })),
  },
  handler: async (ctx: any, args: any) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new ConvexError("Match not found");

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament) throw new ConvexError("Tournament not found");

    // Gate 1: Tournament setting toggle
    if (!tournament.allowPlayerScoreSubmission) {
      throw new ConvexError("Player score submission is disabled by tournament organizer");
    }

    // Gate 2: Player token identity
    const player = await ctx.db
      .query("players")
      .withIndex("by_secret", (q: any) => q.eq("secretCode", args.playerSecret))
      .first();
    if (!player) {
      throw new ConvexError("Invalid player secret token");
    }

    // Gate 3: Player membership in match
    if (player._id !== match.player1Id && player._id !== match.player2Id) {
      throw new ConvexError("Player cannot submit scores for matches they are not participating in");
    }

    // Gate 4: Finalized match lock
    if (match.status === "completed") {
      throw new ConvexError("Match is already completed; contact referee or admin to modify");
    }

    const sportRules = await ctx.db.get(tournament.sportRulesId);
    if (!sportRules) throw new ConvexError("Sport rules not found");

    // Gate 5: Score validity
    const validation = validateMatchScore(args.sets, sportRules as any);
    if (!validation.isValid) {
      throw new ConvexError(validation.error || "Invalid score submission");
    }

    const status = validation.isMatchCompleted ? "completed" : "in_progress";
    const winnerId = validation.isMatchCompleted
      ? validation.winner === 1
        ? match.player1Id
        : match.player2Id
      : undefined;

    await ctx.db.patch(args.matchId, {
      sets: args.sets,
      status,
      winnerId,
      walkover: false,
      scoreSubmittedBy: player._id,
      updatedAt: Date.now(),
    });

    if (status === "completed" && winnerId) {
      const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
      await propagateKnockoutResultInDb(ctx, match.tournamentId, args.matchId, winnerId, loserId);
    }

    return { success: true, status, winnerId };
  },
});

// 5. SET WALKOVER
export const setWalkover = mutation({
  args: {
    matchId: v.id("matches"),
    adminSecret: v.optional(v.string()),
    refereeSecret: v.optional(v.string()),
    winnerPlayerId: v.optional(v.id("players")),
    winnerId: v.optional(v.id("players")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new ConvexError("Match not found");

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament) throw new ConvexError("Tournament not found");

    const { isAdmin } = await verifyAdminOrReferee(
      ctx,
      tournament,
      args.adminSecret,
      args.refereeSecret
    );

    const winnerId = args.winnerPlayerId ?? args.winnerId;
    if (!winnerId) {
      throw new ConvexError("Winner player ID is required");
    }

    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      throw new ConvexError("Winner must be a participant in the match (player1 or player2)");
    }

    const sportRules = await ctx.db.get(tournament.sportRulesId);
    const targetPoints = sportRules?.targetPointsPerUnit ?? 11;
    const unitsToWin = sportRules?.unitsToWinMatch ?? 2;

    const walkoverSets = [];
    const isP1 = winnerId === match.player1Id;
    for (let u = 0; u < unitsToWin; u++) {
      walkoverSets.push({
        s1: isP1 ? targetPoints : 0,
        s2: isP1 ? 0 : targetPoints,
      });
    }

    await ctx.db.patch(args.matchId, {
      sets: walkoverSets,
      status: "completed",
      winnerId: winnerId,
      loserId: isP1 ? match.player2Id : match.player1Id,
      walkover: true,
      walkoverWinnerId: winnerId,
      scoreSubmittedBy: isAdmin ? "admin" : "referee",
      updatedAt: Date.now(),
    });

    const loserId = isP1 ? match.player2Id : match.player1Id;
    await propagateKnockoutResultInDb(ctx, match.tournamentId, args.matchId, winnerId, loserId);

    return { success: true, winnerId: winnerId };
  },
});

// 6. GENERATE KNOCKOUT STAGE
export const generateKnockoutStage = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    stageName: v.optional(v.string()),
    qualifierCount: v.number(),
    includeThirdPlace: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    const existingStages = await ctx.db
      .query("stages")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();

    const stageId = await ctx.db.insert("stages", {
      tournamentId: args.tournamentId,
      type: "knockout",
      name: args.stageName || "Faza pucharowa",
      order: existingStages.length + 1,
      status: "pending",
    });

    const knockoutMatches = generateKnockoutBracket(
      args.qualifierCount,
      args.includeThirdPlace ?? true
    );

    const insertedIds: any[] = [];
    for (const km of knockoutMatches) {
      const matchDoc: any = {
        tournamentId: args.tournamentId,
        stageId,
        roundNumber: km.roundName === "quarterfinals" ? 1 : km.roundName === "semifinals" ? 2 : 3,
        roundName: km.roundName,
        knockoutMatchId: km.id,
        sets: [],
        status: "pending",
        slot1Source: km.slot1 ? { sourceType: km.slot1.sourceType, sourceRef: km.slot1.sourceRef } : undefined,
        slot2Source: km.slot2 ? { sourceType: km.slot2.sourceType, sourceRef: km.slot2.sourceRef } : undefined,
      };

      if (km.slot1?.playerId) matchDoc.player1Id = km.slot1.playerId;
      if (km.slot2?.playerId) matchDoc.player2Id = km.slot2.playerId;

      const mId = await ctx.db.insert("matches", matchDoc);
      insertedIds.push(mId);
    }

    return {
      stageId,
      matchCount: insertedIds.length,
      matchIds: insertedIds,
    };
  },
});

// 7. GET MATCHES FOR PLAYER (Personal Terminal Data Provider)
export const getMatchesForPlayer = query({
  args: {
    tournamentId: v.id("tournaments"),
    playerId: v.id("players"),
  },
  handler: async (ctx: any, args: any) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();

    const playerMatches = matches.filter(
      (m: any) => m.player1Id === args.playerId || m.player2Id === args.playerId
    );

    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const sanitizePlayer = (p: any) => {
      if (!p) return undefined;
      const { secretCode, ...safePlayer } = p;
      return safePlayer;
    };
    const playerMap = new Map(players.map((p: any) => [p._id, sanitizePlayer(p)]));

    const pitches = await ctx.db
      .query("pitches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const pitchMap = new Map(pitches.map((p: any) => [p._id, p]));

    const days = await ctx.db
      .query("days")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    const dayMap = new Map(days.map((d: any) => [d._id, d]));

    const enriched = playerMatches.map((m: any) => {
      const isP1 = m.player1Id === args.playerId;
      const opponentId = isP1 ? m.player2Id : m.player1Id;
      return {
        ...m,
        opponent: opponentId ? playerMap.get(opponentId) : undefined,
        pitch: m.pitchId ? pitchMap.get(m.pitchId) : undefined,
        day: m.dayId ? dayMap.get(m.dayId) : undefined,
        isPlayer1: isP1,
      };
    });

    // Determine upcoming match
    const upcoming =
      enriched
        .filter((m: any) => m.status !== "completed")
        .sort((a: any, b: any) => a.roundNumber - b.roundNumber)[0] || null;

    // Detect rounds where player has a bye
    const allRounds = new Set(matches.map((m: any) => m.roundNumber));
    const playerRounds = new Set(playerMatches.map((m: any) => m.roundNumber));
    const byeRounds = Array.from(allRounds)
      .filter((r) => !playerRounds.has(r))
      .sort((a: any, b: any) => a - b);

    return {
      upcomingMatch: upcoming,
      matches: enriched,
      byeRounds,
    };
  },
});

// Helper for DAG propagation in Convex
async function propagateKnockoutResultInDb(
  ctx: any,
  tournamentId: any,
  sourceMatchId: any,
  winnerId: any,
  loserId: any
) {
  const sourceMatch = await ctx.db.get(sourceMatchId);
  const sourceRef = sourceMatch?.knockoutMatchId || sourceMatchId;

  // 1. Advance knockout bracket matches in this tournament whose slot sources depend on this match
  const tournamentMatches = await ctx.db
    .query("matches")
    .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournamentId))
    .collect();

  for (const m of tournamentMatches) {
    if (m._id === sourceMatchId) continue;
    const patch: any = {};

    if (m.slot1Source) {
      const match1 =
        m.slot1Source.sourceRef === sourceRef ||
        m.slot1Source.sourceRef === sourceMatchId ||
        (sourceMatch?.knockoutMatchId && m.slot1Source.sourceRef === sourceMatch.knockoutMatchId);
      if (match1) {
        if (m.slot1Source.sourceType === "winner_of" && winnerId) {
          patch.player1Id = winnerId;
        } else if (m.slot1Source.sourceType === "loser_of" && loserId) {
          patch.player1Id = loserId;
        }
      }
    }

    if (m.slot2Source) {
      const match2 =
        m.slot2Source.sourceRef === sourceRef ||
        m.slot2Source.sourceRef === sourceMatchId ||
        (sourceMatch?.knockoutMatchId && m.slot2Source.sourceRef === sourceMatch.knockoutMatchId);
      if (match2) {
        if (m.slot2Source.sourceType === "winner_of" && winnerId) {
          patch.player2Id = winnerId;
        } else if (m.slot2Source.sourceType === "loser_of" && loserId) {
          patch.player2Id = loserId;
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(m._id, patch);
    }
  }

  // 2. Check qualificationRules
  const downstreamRules = await ctx.db
    .query("qualificationRules")
    .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournamentId))
    .collect();

  for (const rule of downstreamRules) {
    if (
      rule.sourceMatchId === sourceMatchId ||
      rule.sourceMatchId === sourceRef ||
      (sourceMatch?.knockoutMatchId && rule.sourceMatchId === sourceMatch.knockoutMatchId)
    ) {
      const targetMatch = await ctx.db.get(rule.targetMatchId);
      if (targetMatch) {
        const assignedPlayerId = rule.sourceType === "winner_of" ? winnerId : loserId;
        const patchField = rule.targetSlot === "slot1" ? "player1Id" : "player2Id";
        await ctx.db.patch(rule.targetMatchId, { [patchField]: assignedPlayerId });
      }
    }
  }
}
