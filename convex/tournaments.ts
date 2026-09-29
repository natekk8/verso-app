import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { DEFAULT_SPORT_PRESETS, SportPreset } from "../src/engine/scoring";

// 1. CREATE TOURNAMENT
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    adminSecret: v.optional(v.string()),
    sportPreset: v.optional(v.string()), // "table_tennis" | "padel" | "football" | "esport" | "custom"
    sportRules: v.optional(
      v.object({
        singularUnit: v.string(),
        pluralUnit: v.string(),
        targetPointsPerUnit: v.number(),
        unitsToWinMatch: v.number(),
        hasDeciderTiebreak: v.boolean(),
        deciderThreshold: v.number(),
        deciderPoints: v.number(),
        winByTwo: v.boolean(),
        pointsRule: v.union(v.literal("2_1_matrix"), v.literal("standard_3_1_0")),
      })
    ),
    days: v.optional(
      v.array(
        v.object({
          date: v.string(), // YYYY-MM-DD
          order: v.number(),
        })
      )
    ),
    pitches: v.optional(
      v.array(
        v.object({
          name: v.string(),
          order: v.number(),
        })
      )
    ),
    allowPlayerScoreSubmission: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    // a. Check slug collision
    const existing = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      throw new ConvexError(`Tournament slug "${args.slug}" is already in use.`);
    }

    // b. Determine sport rules
    const presetKey = (args.sportPreset as SportPreset) || "table_tennis";
    const presetDefault = DEFAULT_SPORT_PRESETS[presetKey] || DEFAULT_SPORT_PRESETS.table_tennis;
    const rulesConfig = args.sportRules
      ? { ...presetDefault, ...args.sportRules, preset: presetKey }
      : { ...presetDefault, pointsRule: "2_1_matrix" };

    const sportRulesId = await ctx.db.insert("sportRules", rulesConfig);

    // c. Generate admin token if not passed
    const adminSecret =
      args.adminSecret ||
      `adm-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

    // d. Insert tournament
    const tournamentId = await ctx.db.insert("tournaments", {
      name: args.name,
      slug: args.slug,
      adminSecret,
      sportRulesId,
      allowPlayerScoreSubmission: args.allowPlayerScoreSubmission ?? false,
      createdAt: Date.now(),
    });

    // e. Insert days (default to today if empty)
    const initialDays =
      args.days && args.days.length > 0
        ? args.days
        : [{ date: new Date().toISOString().split("T")[0], order: 1 }];
    for (const d of initialDays) {
      await ctx.db.insert("days", { tournamentId, date: d.date, order: d.order });
    }

    // f. Insert pitches (default to "Stół 1" if empty)
    const initialPitches =
      args.pitches && args.pitches.length > 0
        ? args.pitches
        : [{ name: "Stół 1", order: 1 }];
    for (const p of initialPitches) {
      await ctx.db.insert("pitches", { tournamentId, name: p.name, order: p.order });
    }

    // g. Insert default group stage and "Grupa A"
    const stageId = await ctx.db.insert("stages", {
      tournamentId,
      type: "group",
      name: "Faza grupowa",
      order: 1,
    });
    await ctx.db.insert("groups", {
      stageId,
      tournamentId,
      name: "Grupa A",
    });

    // h. Insert default presentation slide config
    await ctx.db.insert("slides", {
      tournamentId,
      rotationIntervalSeconds: 10,
      announcementText: `Witaj w turnieju ${args.name}!`,
      activeSlides: ["standings", "matches", "announcements"],
    });

    return { tournamentId, slug: args.slug, adminSecret };
  },
});

// 2. GET BY SLUG (Public Safe — Never leaks adminSecret)
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!tournament) return null;

    const sportRules = await ctx.db.get(tournament.sportRulesId);
    const { adminSecret, ...publicTournament } = tournament;
    return { ...publicTournament, sportRules };
  },
});

// 3. VERIFY ADMIN SECRET (Passwordless auth verification & rehydration)
export const verifyAdminSecret = query({
  args: { slug: v.string(), adminSecret: v.string() },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!tournament) {
      return { valid: false, error: "Tournament not found" };
    }
    const valid = tournament.adminSecret === args.adminSecret;
    return {
      valid,
      tournamentId: valid ? tournament._id : undefined,
      name: valid ? tournament.name : undefined,
    };
  },
});

// 4. GET FULL BUNDLE (Hydrates Admin, Spectator, or Player root views)
export const getTournamentBundle = query({
  args: { slug: v.string(), adminSecret: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    if (!tournament) return null;

    const isAdmin = Boolean(args.adminSecret && args.adminSecret === tournament.adminSecret);
    const sportRules = await ctx.db.get(tournament.sportRulesId);

    const days = await ctx.db
      .query("days")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();
    days.sort((a: any, b: any) => a.order - b.order);

    const pitches = await ctx.db
      .query("pitches")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();
    pitches.sort((a: any, b: any) => a.order - b.order);

    const stages = await ctx.db
      .query("stages")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .collect();
    stages.sort((a: any, b: any) => a.order - b.order);

    const groups = [];
    for (const st of stages) {
      const gList = await ctx.db
        .query("groups")
        .withIndex("by_stage", (q: any) => q.eq("stageId", st._id))
        .collect();
      groups.push(...gList);
    }

    const slides = await ctx.db
      .query("slides")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tournament._id))
      .first();

    const { adminSecret, ...publicTourn } = tournament;
    return {
      tournament: isAdmin ? tournament : publicTourn,
      isAdmin,
      sportRules,
      days,
      pitches,
      stages,
      groups,
      slides,
    };
  },
});

// 5. UPDATE SETTINGS
export const updateSettings = mutation({
  args: {
    tournamentId: v.id("tournaments"),
    adminSecret: v.string(),
    name: v.optional(v.string()),
    allowPlayerScoreSubmission: v.optional(v.boolean()),
    sportRules: v.optional(
      v.object({
        singularUnit: v.optional(v.string()),
        pluralUnit: v.optional(v.string()),
        targetPointsPerUnit: v.optional(v.number()),
        unitsToWinMatch: v.optional(v.number()),
        hasDeciderTiebreak: v.optional(v.boolean()),
        deciderThreshold: v.optional(v.number()),
        deciderPoints: v.optional(v.number()),
        winByTwo: v.optional(v.boolean()),
        pointsRule: v.optional(v.union(v.literal("2_1_matrix"), v.literal("standard_3_1_0"))),
      })
    ),
  },
  handler: async (ctx: any, args: any) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament || tournament.adminSecret !== args.adminSecret) {
      throw new ConvexError("Unauthorized: invalid admin token");
    }

    const updates: Record<string, any> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.allowPlayerScoreSubmission !== undefined) {
      updates.allowPlayerScoreSubmission = args.allowPlayerScoreSubmission;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.tournamentId, updates);
    }

    if (args.sportRules) {
      await ctx.db.patch(tournament.sportRulesId, args.sportRules);
    }

    return { success: true };
  },
});
