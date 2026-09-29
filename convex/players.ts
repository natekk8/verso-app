import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// 1. LIST PLAYERS BY TOURNAMENT
export const listByTournament = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx: any, args: any) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    return players.sort((a: any, b: any) => (a.groupSlotIndex ?? 0) - (b.groupSlotIndex ?? 0));
  },
});

// 2. CREATE SINGLE PLAYER
export const create = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    name: v.string(),
    groupSlotIndex: v.optional(v.number()),
    secretCode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    let slotIndex = args.groupSlotIndex;
    if (slotIndex === undefined) {
      const existing = await ctx.db
        .query("players")
        .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
        .collect();
      slotIndex = existing.length;
    }

    const secretCode = args.secretCode || `p-${Math.random().toString(36).slice(2, 10)}`;

    const playerId = await ctx.db.insert("players", {
      tournamentId: args.tournamentId,
      name: args.name,
      secretCode,
      groupSlotIndex: slotIndex,
      checkedIn: false,
      notes: args.notes,
      createdAt: Date.now(),
    });

    return { playerId, secretCode, groupSlotIndex: slotIndex };
  },
});

// 3. BULK CREATE PLAYERS
export const bulkCreate = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    players: v.array(
      v.object({
        name: v.string(),
        secretCode: v.optional(v.string()),
        groupSlotIndex: v.optional(v.number()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();
    let currentSlot = existing.length;

    const createdIds: any[] = [];
    for (const p of args.players) {
      const secret = p.secretCode || `p-${Math.random().toString(36).slice(2, 10)}`;
      const slot = p.groupSlotIndex !== undefined ? p.groupSlotIndex : currentSlot++;
      const id = await ctx.db.insert("players", {
        tournamentId: args.tournamentId,
        name: p.name,
        secretCode: secret,
        groupSlotIndex: slot,
        checkedIn: false,
        notes: p.notes,
        createdAt: Date.now(),
      });
      createdIds.push(id);
    }

    return { createdCount: createdIds.length, playerIds: createdIds };
  },
});

// 4. GET BY SECRET (Powers /[slug]/p/[playerSecret])
export const getBySecret = query({
  args: { secretCode: v.string() },
  handler: async (ctx: any, args: any) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_secret", (q: any) => q.eq("secretCode", args.secretCode))
      .first();
    if (!player) return null;

    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament) return null;

    const sportRules = await ctx.db.get(tournament.sportRulesId);

    return {
      player,
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        slug: tournament.slug,
        allowPlayerScoreSubmission: tournament.allowPlayerScoreSubmission,
      },
      sportRules,
    };
  },
});

// 5. TOGGLE CHECK-IN
export const toggleCheckIn = mutation({
  args: {
    playerId: v.id("players"),
    adminSecret: v.optional(v.string()),
    playerSecret: v.optional(v.string()),
    checkedIn: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new ConvexError("Player not found");

    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament) throw new ConvexError("Tournament not found");

    const isAdmin = Boolean(args.adminSecret && args.adminSecret === tournament.adminSecret);
    const isPlayer = Boolean(args.playerSecret && args.playerSecret === player.secretCode);

    if (!isAdmin && !isPlayer) {
      throw new ConvexError("Unauthorized: check-in requires admin or player token");
    }

    const nextStatus = args.checkedIn !== undefined ? args.checkedIn : !player.checkedIn;
    await ctx.db.patch(args.playerId, { checkedIn: nextStatus });

    return { success: true, checkedIn: nextStatus };
  },
});

// 6. DELETE PLAYER
export const deletePlayer = mutation({
  args: {
    playerId: v.id("players"),
    adminSecret: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new ConvexError("Player not found");
    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }
    await ctx.db.delete(args.playerId);
    return { success: true };
  },
});
