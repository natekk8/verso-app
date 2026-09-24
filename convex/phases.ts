import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Returns all phases for a given tournament, sorted ascending by `order`.
 */
export const getByTournament = query({
  args: {
    tournamentId: v.id('tournaments'),
  },
  handler: async (ctx, { tournamentId }) => {
    const phases = await ctx.db
      .query('phases')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
      .collect();

    return phases.sort((a, b) => a.order - b.order);
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Creates a new phase for a tournament.
 * Requires a valid adminToken.
 */
export const create = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    name: v.string(),
    type: v.union(
      v.literal('group'),
      v.literal('bracket'),
      v.literal('single_match'),
    ),
    order: v.number(),
    matchDuration: v.optional(v.number()),
  },
  handler: async (ctx, { tournamentId, adminToken, name, type, order, matchDuration }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const phaseId = await ctx.db.insert('phases', {
      tournamentId,
      name,
      type,
      order,
      status: 'pending',
      matchDuration: matchDuration ?? 45,
    });

    return phaseId;
  },
});

/**
 * Updates the name, type, and/or matchDuration of an existing phase.
 * Requires a valid adminToken.
 */
export const update = mutation({
  args: {
    phaseId: v.id('phases'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    name: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal('group'),
        v.literal('bracket'),
        v.literal('single_match'),
      ),
    ),
    matchDuration: v.optional(v.number()),
  },
  handler: async (ctx, { phaseId, tournamentId, adminToken, name, type, matchDuration }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const phase = await ctx.db.get(phaseId);
    if (!phase) throw new Error('Faza nie istnieje.');
    if (phase.tournamentId !== tournamentId) throw new Error('Faza nie należy do tego turnieju.');

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (type !== undefined) patch.type = type;
    if (matchDuration !== undefined) patch.matchDuration = matchDuration;

    await ctx.db.patch(phaseId, patch);
  },
});

/**
 * Changes the status of a phase to 'pending', 'active', or 'finished'.
 * Requires a valid adminToken.
 */
export const updateStatus = mutation({
  args: {
    phaseId: v.id('phases'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('active'),
      v.literal('finished'),
    ),
  },
  handler: async (ctx, { phaseId, tournamentId, adminToken, status }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const phase = await ctx.db.get(phaseId);
    if (!phase) throw new Error('Faza nie istnieje.');
    if (phase.tournamentId !== tournamentId) throw new Error('Faza nie należy do tego turnieju.');

    await ctx.db.patch(phaseId, { status });
  },
});

/**
 * Deletes a phase along with all its groups and matches.
 * Requires a valid adminToken.
 */
export const remove = mutation({
  args: {
    phaseId: v.id('phases'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
  },
  handler: async (ctx, { phaseId, tournamentId, adminToken }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const phase = await ctx.db.get(phaseId);
    if (!phase) throw new Error('Faza nie istnieje.');
    if (phase.tournamentId !== tournamentId) throw new Error('Faza nie należy do tego turnieju.');

    // Delete all matches belonging to this phase
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_phase', (q) => q.eq('phaseId', phaseId))
      .collect();
    await Promise.all(matches.map((m) => ctx.db.delete(m._id)));

    // Delete all groups belonging to this phase (and their matches)
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_phase', (q) => q.eq('phaseId', phaseId))
      .collect();

    for (const group of groups) {
      const groupMatches = await ctx.db
        .query('matches')
        .withIndex('by_group', (q) => q.eq('groupId', group._id))
        .collect();
      await Promise.all(groupMatches.map((m) => ctx.db.delete(m._id)));
      await ctx.db.delete(group._id);
    }

    // Finally delete the phase itself
    await ctx.db.delete(phaseId);
  },
});

/**
 * Updates the `order` field of multiple phases at once.
 * Receives an array of { phaseId, order } pairs.
 * Requires a valid adminToken.
 */
export const reorder = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    updates: v.array(
      v.object({
        phaseId: v.id('phases'),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, { tournamentId, adminToken, updates }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    await Promise.all(
      updates.map(({ phaseId, order }) => ctx.db.patch(phaseId, { order })),
    );
  },
});
