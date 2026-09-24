import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Get all tournaments (by admin token list) ─────────────────
export const getByIds = query({
  args: { ids: v.array(v.id("tournaments")) },
  handler: async (ctx, { ids }) => {
    const results = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return results.filter(Boolean);
  },
});

// ─── Get single tournament ────────────────────────────────────
export const get = query({
  args: { id: v.id("tournaments") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ─── Get tournament by ID (public - no auth needed) ───────────
export const getPublic = query({
  args: { id: v.id("tournaments") },
  handler: async (ctx, { id }) => {
    const tournament = await ctx.db.get(id);
    if (!tournament || !tournament.publicPageEnabled) return null;
    // Strip admin token from public response
    const { adminToken: _, ...publicData } = tournament;
    return publicData;
  },
});

// ─── Create tournament ────────────────────────────────────────
export const create = mutation({
  args: {
    name: v.string(),
    sport: v.optional(v.string()),
    adminToken: v.string(),
    firstMatchDay: v.optional(v.string()), // ISO date
  },
  handler: async (ctx, { name, sport, adminToken, firstMatchDay }) => {
    const now = Date.now();
    const matchDays = firstMatchDay
      ? [{ id: crypto.randomUUID(), date: firstMatchDay, startTime: "09:00", endTime: "18:00" }]
      : [];

    const id = await ctx.db.insert("tournaments", {
      name,
      sport,
      adminToken,
      status: "draft",
      isOnline: false,
      matchDays,
      locations: [{ id: crypto.randomUUID(), name: "Boisko 1", order: 1 }],
      languages: ["pl"],
      scoring: {
        id: crypto.randomUUID(),
        name: "Punktacja 1",
        type: "standard",
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        tiebreakers: ["head_to_head", "score_diff"],
        useSets: false,
      },
      publicPageEnabled: false,
      registrationEnabled: false,
      updatedAt: now,
    });
    return id;
  },
});

// ─── Update tournament name ───────────────────────────────────
export const updateName = mutation({
  args: { id: v.id("tournaments"), name: v.string(), adminToken: v.string() },
  handler: async (ctx, { id, name, adminToken }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { name, updatedAt: Date.now() });
  },
});

// ─── Update match days ────────────────────────────────────────
export const updateMatchDays = mutation({
  args: {
    id: v.id("tournaments"),
    adminToken: v.string(),
    matchDays: v.array(
      v.object({
        id: v.string(),
        date: v.string(),
        startTime: v.optional(v.string()),
        endTime: v.optional(v.string()),
        label: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { id, adminToken, matchDays }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { matchDays, updatedAt: Date.now() });
  },
});

// ─── Update locations ─────────────────────────────────────────
export const updateLocations = mutation({
  args: {
    id: v.id("tournaments"),
    adminToken: v.string(),
    locations: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, { id, adminToken, locations }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { locations, updatedAt: Date.now() });
  },
});

// ─── Update scoring ───────────────────────────────────────────
export const updateScoring = mutation({
  args: {
    id: v.id("tournaments"),
    adminToken: v.string(),
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
  },
  handler: async (ctx, { id, adminToken, scoring }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { scoring, updatedAt: Date.now() });
  },
});

// ─── Toggle public page ───────────────────────────────────────
export const togglePublicPage = mutation({
  args: { id: v.id("tournaments"), adminToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { id, adminToken, enabled }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { publicPageEnabled: enabled, updatedAt: Date.now() });
  },
});

// ─── Toggle registration ──────────────────────────────────────
export const toggleRegistration = mutation({
  args: { id: v.id("tournaments"), adminToken: v.string(), enabled: v.boolean() },
  handler: async (ctx, { id, adminToken, enabled }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { registrationEnabled: enabled, updatedAt: Date.now() });
  },
});

// ─── Update status ────────────────────────────────────────────
export const updateStatus = mutation({
  args: {
    id: v.id("tournaments"),
    adminToken: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("finished")),
  },
  handler: async (ctx, { id, adminToken, status }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

// ─── Update general settings (isOnline, languages, etc.) ─────
export const updateSettings = mutation({
  args: {
    id: v.id("tournaments"),
    adminToken: v.string(),
    isOnline: v.optional(v.boolean()),
    languages: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { id, adminToken, ...updates }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
  },
});

// ─── Delete tournament (cascade) ─────────────────────────────
export const remove = mutation({
  args: { id: v.id("tournaments"), adminToken: v.string() },
  handler: async (ctx, { id, adminToken }) => {
    const t = await ctx.db.get(id);
    if (!t || t.adminToken !== adminToken) throw new Error("Unauthorized");

    // Delete all related data
    const players = await ctx.db.query("players").withIndex("by_tournament", q => q.eq("tournamentId", id)).collect();
    for (const p of players) await ctx.db.delete(p._id);

    const phases = await ctx.db.query("phases").withIndex("by_tournament", q => q.eq("tournamentId", id)).collect();
    for (const ph of phases) await ctx.db.delete(ph._id);

    const groups = await ctx.db.query("groups").withIndex("by_tournament", q => q.eq("tournamentId", id)).collect();
    for (const g of groups) await ctx.db.delete(g._id);

    const matches = await ctx.db.query("matches").withIndex("by_tournament", q => q.eq("tournamentId", id)).collect();
    for (const m of matches) await ctx.db.delete(m._id);

    const registrations = await ctx.db.query("registrations").withIndex("by_tournament", q => q.eq("tournamentId", id)).collect();
    for (const r of registrations) await ctx.db.delete(r._id);

    await ctx.db.delete(id);
  },
});
