import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Throws if the provided adminToken doesn't match the tournament's adminToken. */
async function verifyAdmin(
  ctx: any,
  tournamentId: string,
  adminToken: string
) {
  const t = await ctx.db.get(tournamentId);
  if (!t) throw new Error("Turniej nie znaleziony.");
  if (t.adminToken !== adminToken) throw new Error("Nieprawidłowy token administratora.");
  return t;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * getByTournament — returns all players for a tournament, sorted by `order`.
 * No authentication required (public data for tournament view).
 */
export const getByTournament = query({
  args: {
    tournamentId: v.id("tournaments"),
  },
  handler: async (ctx, { tournamentId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    return players.sort((a, b) => a.order - b.order);
  },
});

/**
 * getByToken — returns a single player looked up by their unique playerToken.
 * No authentication required (used for the player's personal view page).
 */
export const getByToken = query({
  args: {
    playerToken: v.string(),
  },
  handler: async (ctx, { playerToken }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_player_token", (q) => q.eq("playerToken", playerToken))
      .unique();

    return player ?? null;
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * add — inserts a single player into a tournament.
 * Requires a valid adminToken for the tournament.
 */
export const add = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminToken: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    customFields: v.optional(v.record(v.string(), v.string())),
    registrationStatus: v.optional(
      v.union(
        v.literal("confirmed"),
        v.literal("pending"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (
    ctx,
    {
      tournamentId,
      adminToken,
      name,
      email,
      phone,
      notes,
      customFields,
      registrationStatus,
    }
  ) => {
    // Verify admin
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    // Determine order (existing count + 1)
    const existing = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const order = existing.length + 1;

    // Generate unique playerToken
    const playerToken = crypto.randomUUID().replace(/-/g, "");

    const playerId = await ctx.db.insert("players", {
      tournamentId,
      name: name.trim(),
      email: email?.trim(),
      phone: phone?.trim(),
      notes: notes?.trim(),
      customFields: customFields ?? {},
      playerToken,
      registrationStatus: registrationStatus ?? "confirmed",
      order,
    });

    return { playerId, playerToken };
  },
});

/**
 * addBulk — inserts multiple players at once from an array of names.
 * Requires a valid adminToken for the tournament.
 * Players are added in the order provided, appended after existing players.
 */
export const addBulk = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminToken: v.string(),
    names: v.array(v.string()),
    registrationStatus: v.optional(
      v.union(
        v.literal("confirmed"),
        v.literal("pending"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, { tournamentId, adminToken, names, registrationStatus }) => {
    // Verify admin
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    if (names.length === 0) return { added: 0, players: [] };

    // Determine starting order
    const existing = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    let nextOrder = existing.length + 1;

    const results: { playerId: string; name: string; playerToken: string }[] =
      [];

    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue; // skip blank entries

      const playerToken = crypto.randomUUID().replace(/-/g, "");

      const playerId = await ctx.db.insert("players", {
        tournamentId,
        name,
        email: undefined,
        phone: undefined,
        notes: undefined,
        customFields: {},
        playerToken,
        registrationStatus: registrationStatus ?? "confirmed",
        order: nextOrder,
      });

      results.push({ playerId, name, playerToken });
      nextOrder++;
    }

    return { added: results.length, players: results };
  },
});

/**
 * update — updates editable fields of an existing player.
 * Requires a valid adminToken for the tournament.
 */
export const update = mutation({
  args: {
    playerId: v.id("players"),
    adminToken: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    customFields: v.optional(v.record(v.string(), v.string())),
    order: v.optional(v.number()),
    registrationStatus: v.optional(
      v.union(
        v.literal("confirmed"),
        v.literal("pending"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (
    ctx,
    {
      playerId,
      adminToken,
      name,
      email,
      phone,
      notes,
      customFields,
      order,
      registrationStatus,
    }
  ) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Zawodnik nie znaleziony.");

    // Verify admin against the player's tournament
    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    // Build patch object — only include provided fields
    const patch: Partial<{
      name: string;
      email: string | undefined;
      phone: string | undefined;
      notes: string | undefined;
      customFields: Record<string, string>;
      order: number;
      registrationStatus: "confirmed" | "pending" | "rejected";
    }> = {};

    if (name !== undefined) patch.name = name.trim();
    if (email !== undefined) patch.email = email.trim() || undefined;
    if (phone !== undefined) patch.phone = phone.trim() || undefined;
    if (notes !== undefined) patch.notes = notes.trim() || undefined;
    if (customFields !== undefined) patch.customFields = customFields;
    if (order !== undefined) patch.order = order;
    if (registrationStatus !== undefined)
      patch.registrationStatus = registrationStatus;

    await ctx.db.patch(playerId, patch);
    return { success: true };
  },
});

/**
 * remove — permanently deletes a player from the database.
 * Requires a valid adminToken for the tournament.
 */
export const remove = mutation({
  args: {
    playerId: v.id("players"),
    adminToken: v.string(),
  },
  handler: async (ctx, { playerId, adminToken }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Zawodnik nie znaleziony.");

    // Verify admin
    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    await ctx.db.delete(playerId);
    return { success: true };
  },
});

/**
 * updateRegistrationStatus — approve or reject a pending registration.
 * Requires a valid adminToken for the tournament.
 *
 * When approving a previously "pending" player their registrationStatus
 * becomes "confirmed"; when rejecting it becomes "rejected".
 */
export const updateRegistrationStatus = mutation({
  args: {
    playerId: v.id("players"),
    adminToken: v.string(),
    status: v.union(
      v.literal("confirmed"),
      v.literal("pending"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, { playerId, adminToken, status }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Zawodnik nie znaleziony.");

    // Verify admin
    const tournament = await ctx.db.get(player.tournamentId);
    if (!tournament) throw new Error("Turniej nie znaleziony.");
    if (tournament.adminToken !== adminToken)
      throw new Error("Nieprawidłowy token administratora.");

    await ctx.db.patch(playerId, { registrationStatus: status });
    return { success: true, newStatus: status };
  },
});
