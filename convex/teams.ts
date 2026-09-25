import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    return teams.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  },
});

export const create = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminToken: v.string(),
    name: v.string(),
    playerIds: v.optional(v.array(v.id("players"))),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { tournamentId, adminToken, name, playerIds, color }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    const teamId = await ctx.db.insert("teams", {
      tournamentId,
      name: name.trim(),
      playerIds: playerIds || [],
      color,
      createdAt: Date.now(),
    });
    return teamId;
  },
});

export const remove = mutation({
  args: {
    teamId: v.id("teams"),
    adminToken: v.string(),
  },
  handler: async (ctx, { teamId, adminToken }) => {
    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Zespół nie znaleziony.");

    const tournament = await ctx.db.get(team.tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    await ctx.db.delete(teamId);
    return { success: true };
  },
});
