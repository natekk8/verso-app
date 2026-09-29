import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { calculateGroupStandingsInternal } from "./standings";

// 1. GET SLIDE CONFIG
export const getSlideConfig = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx: any, args: any) => {
    const slide = await ctx.db
      .query("slides")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .first();
    if (!slide) {
      return {
        rotationIntervalSeconds: 10,
        announcementText: "Witaj w Mistrzostwach Verso!",
        activeSlides: ["standings", "matches", "announcements"],
      };
    }
    return slide;
  },
});

// 2. UPDATE SLIDE CONFIG (Admin only)
export const updateSlideConfig = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    rotationIntervalSeconds: v.optional(v.number()),
    announcementText: v.optional(v.string()),
    activeSlides: v.optional(
      v.array(
        v.union(
          v.literal("standings"),
          v.literal("matches"),
          v.literal("announcements"),
          v.literal("announcement")
        )
      )
    ),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    const slide = await ctx.db
      .query("slides")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .first();

    const updates: Record<string, any> = {};
    if (args.rotationIntervalSeconds !== undefined) {
      updates.rotationIntervalSeconds = args.rotationIntervalSeconds;
    }
    if (args.announcementText !== undefined) {
      updates.announcementText = args.announcementText;
    }
    if (args.activeSlides !== undefined) {
      updates.activeSlides = args.activeSlides;
    }
    updates.updatedAt = Date.now();

    if (slide) {
      await ctx.db.patch(slide._id, updates);
    } else {
      await ctx.db.insert("slides", {
        tournamentId: args.tournamentId,
        rotationIntervalSeconds: args.rotationIntervalSeconds ?? 10,
        announcementText: args.announcementText ?? "Witaj w Mistrzostwach Verso!",
        activeSlides: args.activeSlides ?? ["standings", "matches", "announcements"],
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// 3. GET COMPOSITE PRESENTER DATA (Powers /[slug]/present)
export const getPresenterData = query({
  args: { slug: v.string() },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!tournament) return null;

    const slideConfig = await ctx.db
      .query("slides")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .first();

    // Fetch players, pitches, days
    const players = await ctx.db
      .query("players")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();
    const playerMap = new Map(players.map((p: any) => [p._id, p]));

    const pitches = await ctx.db
      .query("pitches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();
    const pitchMap = new Map(pitches.map((p: any) => [p._id, p]));

    // Fetch matches
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();

    const inProgress = matches
      .filter((m: any) => m.status === "in_progress")
      .map((m: any) => ({
        ...m,
        player1: m.player1Id ? playerMap.get(m.player1Id) : undefined,
        player2: m.player2Id ? playerMap.get(m.player2Id) : undefined,
        pitch: m.pitchId ? pitchMap.get(m.pitchId) : undefined,
      }));

    const upcoming = matches
      .filter((m: any) => m.status === "pending")
      .sort((a: any, b: any) => a.roundNumber - b.roundNumber)
      .slice(0, 6)
      .map((m: any) => ({
        ...m,
        player1: m.player1Id ? playerMap.get(m.player1Id) : undefined,
        player2: m.player2Id ? playerMap.get(m.player2Id) : undefined,
        pitch: m.pitchId ? pitchMap.get(m.pitchId) : undefined,
      }));

    // Group stage standings
    const stage = await ctx.db
      .query("stages")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .first();

    let standings: any[] = [];
    if (stage) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_stage", (q: any) => q.eq("stageId", stage._id))
        .first();
      if (group) {
        standings = await calculateGroupStandingsInternal(ctx, group._id);
      }
    }

    return {
      tournament: { name: tournament.name, slug: tournament.slug },
      slideConfig: slideConfig || {
        rotationIntervalSeconds: 10,
        announcementText: "Witaj w Mistrzostwach Verso!",
        activeSlides: ["standings", "matches", "announcements"],
      },
      inProgressMatches: inProgress,
      upcomingMatches: upcoming,
      standings,
    };
  },
});
