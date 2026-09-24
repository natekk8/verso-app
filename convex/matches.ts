import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns all matches belonging to a tournament. */
export const getByTournament = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, { tournamentId }) => {
    return await ctx.db
      .query('matches')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
      .collect();
  },
});

/** Returns all matches belonging to a phase. */
export const getByPhase = query({
  args: { phaseId: v.id('phases') },
  handler: async (ctx, { phaseId }) => {
    return await ctx.db
      .query('matches')
      .withIndex('by_phase', (q) => q.eq('phaseId', phaseId))
      .collect();
  },
});

/** Returns all matches belonging to a group. */
export const getByGroup = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, { groupId }) => {
    return await ctx.db
      .query('matches')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect();
  },
});

/** Returns all matches scheduled for a specific day within a tournament. */
export const getByScheduleDay = query({
  args: {
    tournamentId: v.id('tournaments'),
    dayId: v.id('scheduleDays'),
  },
  handler: async (ctx, { tournamentId, dayId }) => {
    return await ctx.db
      .query('matches')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
      .filter((q) => q.eq(q.field('scheduledDayId'), dayId))
      .collect();
  },
});

/** Returns all matches in which a given player participates. */
export const getByPlayer = query({
  args: {
    tournamentId: v.id('tournaments'),
    playerId: v.id('players'),
  },
  handler: async (ctx, { tournamentId, playerId }) => {
    const all = await ctx.db
      .query('matches')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
      .collect();

    return all.filter(
      (m) => m.player1Id === playerId || m.player2Id === playerId,
    );
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Creates multiple matches at once — used when generating round-robin or
 * bracket match sets. Each item in `matches` follows the matches table schema
 * (without _id / _creationTime).
 */
export const createMany = mutation({
  args: {
    adminToken: v.string(),
    matches: v.array(
      v.object({
        tournamentId: v.id('tournaments'),
        phaseId: v.id('phases'),
        groupId: v.optional(v.id('groups')),
        player1Id: v.union(v.id('players'), v.null()),
        player2Id: v.union(v.id('players'), v.null()),
        round: v.number(),
        matchNumber: v.number(),
        matchLabel: v.string(),
        status: v.union(
          v.literal('pending'),
          v.literal('in_progress'),
          v.literal('finished'),
        ),
        scheduledDayId: v.optional(v.string()),
        scheduledTime: v.optional(v.string()),
        locationId: v.optional(v.string()),
        nextMatchId: v.optional(v.id('matches')),
        nextMatchSlot: v.optional(v.union(v.literal(1), v.literal(2))),
      }),
    ),
  },
  handler: async (ctx, { adminToken, matches }) => {
    // Validate admin token
    const tournament = await ctx.db
      .query('tournaments')
      .filter((q) => q.eq(q.field('adminToken'), adminToken))
      .first();

    if (!tournament) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    const ids: string[] = [];

    for (const match of matches) {
      const id = await ctx.db.insert('matches', {
        tournamentId: match.tournamentId,
        phaseId: match.phaseId,
        groupId: match.groupId,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        round: match.round,
        matchNumber: match.matchNumber,
        matchLabel: match.matchLabel,
        status: match.status,
        scheduledDayId: match.scheduledDayId,
        scheduledTime: match.scheduledTime,
        locationId: match.locationId,
        nextMatchId: match.nextMatchId,
        nextMatchSlot: match.nextMatchSlot,
      });
      ids.push(id);
    }

    return ids;
  },
});

/**
 * Updates the result (scores) of a match. Calculates winnerId, sets status to
 * 'finished', and propagates the winner to the next match in the bracket if
 * `nextMatchId` is set.
 */
export const updateResult = mutation({
  args: {
    id: v.id('matches'),
    adminToken: v.string(),
    player1Score: v.number(),
    player2Score: v.number(),
    player1Sets: v.optional(v.number()),
    player2Sets: v.optional(v.number()),
    setsDetails: v.optional(v.array(v.object({ p1: v.number(), p2: v.number() }))),
  },
  handler: async (
    ctx,
    { id, adminToken, player1Score, player2Score, player1Sets, player2Sets,
      setsDetails },
  ) => {
    const match = await ctx.db.get(id);
    if (!match) {
      throw new Error('Mecz nie istnieje.');
    }

    // Validate admin token against the match's tournament
    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament || tournament.adminToken !== adminToken) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    // Determine winner (null = draw)
    const winnerId =
      player1Score > player2Score
        ? (match.player1Id ?? null)
        : player2Score > player1Score
          ? (match.player2Id ?? null)
          : null;

    // Patch fields
    const patch: Record<string, unknown> = {
      player1Score,
      player2Score,
      winnerId,
      status: 'finished' as const,
    };
    if (player1Sets !== undefined) patch.player1Sets = player1Sets;
    if (player2Sets !== undefined) patch.player2Sets = player2Sets;
    if (setsDetails !== undefined) patch.setsDetails = setsDetails;

    await ctx.db.patch(id, patch);

    // Propagate winner to the next bracket match if applicable
    if (match.nextMatchId && winnerId !== null) {
      const nextMatch = await ctx.db.get(match.nextMatchId);
      if (nextMatch) {
        if (match.nextMatchSlot === 1) {
          await ctx.db.patch(match.nextMatchId, { player1Id: winnerId });
        } else if (match.nextMatchSlot === 2) {
          await ctx.db.patch(match.nextMatchId, { player2Id: winnerId });
        }
      }
    }

    return id;
  },
});

/** Updates scheduling details (day, time, location) for a single match. */
export const updateSchedule = mutation({
  args: {
    id: v.id('matches'),
    adminToken: v.string(),
    scheduledDayId: v.optional(v.id('scheduleDays')),
    scheduledTime: v.optional(v.string()),
    locationId: v.optional(v.id('locations')),
  },
  handler: async (ctx, { id, adminToken, scheduledDayId, scheduledTime, locationId }) => {
    const match = await ctx.db.get(id);
    if (!match) {
      throw new Error('Mecz nie istnieje.');
    }

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament || tournament.adminToken !== adminToken) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    const patch: Record<string, unknown> = {};
    if (scheduledDayId !== undefined) patch.scheduledDayId = scheduledDayId;
    if (scheduledTime !== undefined) patch.scheduledTime = scheduledTime;
    if (locationId !== undefined) patch.locationId = locationId;

    await ctx.db.patch(id, patch);
    return id;
  },
});

/**
 * Clears scores and resets match status to 'pending'. Also clears winnerId.
 * Does NOT remove player assignments or scheduling.
 */
export const clearResult = mutation({
  args: {
    id: v.id('matches'),
    adminToken: v.string(),
  },
  handler: async (ctx, { id, adminToken }) => {
    const match = await ctx.db.get(id);
    if (!match) {
      throw new Error('Mecz nie istnieje.');
    }

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament || tournament.adminToken !== adminToken) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    await ctx.db.patch(id, {
      player1Score: undefined,
      player2Score: undefined,
      player1Sets: undefined,
      player2Sets: undefined,
      winnerId: undefined,
      status: 'pending',
    });

    return id;
  },
});

/** Deletes a single match by ID. */
export const remove = mutation({
  args: {
    id: v.id('matches'),
    adminToken: v.string(),
  },
  handler: async (ctx, { id, adminToken }) => {
    const match = await ctx.db.get(id);
    if (!match) {
      throw new Error('Mecz nie istnieje.');
    }

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament || tournament.adminToken !== adminToken) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    await ctx.db.delete(id);
    return id;
  },
});

/** Deletes ALL matches belonging to a phase. */
export const removeByPhase = mutation({
  args: {
    phaseId: v.id('phases'),
    adminToken: v.string(),
  },
  handler: async (ctx, { phaseId, adminToken }) => {
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_phase', (q) => q.eq('phaseId', phaseId))
      .collect();

    if (matches.length === 0) return [];

    // Validate admin token once using the first match's tournament
    const tournament = await ctx.db.get(matches[0].tournamentId);
    if (!tournament || tournament.adminToken !== adminToken) {
      throw new Error('Nieprawidłowy token administratora.');
    }

    const deletedIds: string[] = [];
    for (const match of matches) {
      await ctx.db.delete(match._id);
      deletedIds.push(match._id);
    }

    return deletedIds;
  },
});
