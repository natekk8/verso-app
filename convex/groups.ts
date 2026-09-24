import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Returns all groups belonging to a given phase.
 */
export const getByPhase = query({
  args: {
    phaseId: v.id('phases'),
  },
  handler: async (ctx, { phaseId }) => {
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_phase', (q) => q.eq('phaseId', phaseId))
      .collect();

    return groups;
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Creates a new group within a phase.
 * Requires a valid adminToken verified against the parent tournament.
 */
export const create = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    phaseId: v.id('phases'),
    name: v.string(),
    playerIds: v.array(v.id('players')),
  },
  handler: async (ctx, { tournamentId, adminToken, phaseId, name, playerIds }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const phase = await ctx.db.get(phaseId);
    if (!phase) throw new Error('Faza nie istnieje.');
    if (phase.tournamentId !== tournamentId) throw new Error('Faza nie należy do tego turnieju.');

    const groupId = await ctx.db.insert('groups', {
      tournamentId,
      phaseId,
      name,
      playerIds,
      order: 0,
    });

    return groupId;
  },
});

/**
 * Updates the name and/or playerIds of an existing group.
 * Requires a valid adminToken.
 */
export const update = mutation({
  args: {
    groupId: v.id('groups'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    name: v.optional(v.string()),
    playerIds: v.optional(v.array(v.id('players'))),
  },
  handler: async (ctx, { groupId, tournamentId, adminToken, name, playerIds }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error('Grupa nie istnieje.');
    if (group.tournamentId !== tournamentId) throw new Error('Grupa nie należy do tego turnieju.');

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (playerIds !== undefined) patch.playerIds = playerIds;

    await ctx.db.patch(groupId, patch);
  },
});

/**
 * Deletes a group and all matches associated with it.
 * Requires a valid adminToken.
 */
export const remove = mutation({
  args: {
    groupId: v.id('groups'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
  },
  handler: async (ctx, { groupId, tournamentId, adminToken }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error('Grupa nie istnieje.');
    if (group.tournamentId !== tournamentId) throw new Error('Grupa nie należy do tego turnieju.');

    // Delete all matches belonging to this group
    const matches = await ctx.db
      .query('matches')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect();
    await Promise.all(matches.map((m) => ctx.db.delete(m._id)));

    // Delete the group itself
    await ctx.db.delete(groupId);
  },
});

/**
 * Adds a single player to a group's playerIds array.
 * Skips silently if the player is already in the group.
 * Requires a valid adminToken.
 */
export const addPlayer = mutation({
  args: {
    groupId: v.id('groups'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    playerId: v.id('players'),
  },
  handler: async (ctx, { groupId, tournamentId, adminToken, playerId }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error('Grupa nie istnieje.');
    if (group.tournamentId !== tournamentId) throw new Error('Grupa nie należy do tego turnieju.');

    // Avoid duplicates
    if (group.playerIds.includes(playerId)) return;

    await ctx.db.patch(groupId, {
      playerIds: [...group.playerIds, playerId],
    });
  },
});

/**
 * Removes a single player from a group's playerIds array.
 * Skips silently if the player is not in the group.
 * Requires a valid adminToken.
 */
export const removePlayer = mutation({
  args: {
    groupId: v.id('groups'),
    tournamentId: v.id('tournaments'),
    adminToken: v.string(),
    playerId: v.id('players'),
  },
  handler: async (ctx, { groupId, tournamentId, adminToken, playerId }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error('Turniej nie istnieje.');
    if (tournament.adminToken !== adminToken) throw new Error('Nieprawidłowy token administratora.');

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error('Grupa nie istnieje.');
    if (group.tournamentId !== tournamentId) throw new Error('Grupa nie należy do tego turnieju.');

    const updated = group.playerIds.filter((id) => id !== playerId);
    if (updated.length === group.playerIds.length) return; // player wasn't in the group

    await ctx.db.patch(groupId, { playerIds: updated });
  },
});
