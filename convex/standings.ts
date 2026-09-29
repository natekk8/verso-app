import { query } from "./_generated/server";
import { v } from "convex/values";
import { calculateStandings, MatchResultInput, PointsRule } from "../src/engine/standings";

export async function calculateGroupStandingsInternal(
  ctx: any,
  groupId: any,
  pointsRuleOverride?: PointsRule
) {
  const group = await ctx.db.get(groupId);
  if (!group) return [];

  const stage = await ctx.db.get(group.stageId);
  if (!stage) return [];

  const tournament = await ctx.db.get(stage.tournamentId);
  if (!tournament) return [];

  const sportRules = await ctx.db.get(tournament.sportRulesId);
  const pointsRule = (pointsRuleOverride ||
    sportRules?.pointsRule ||
    "2_1_matrix") as PointsRule;

  const allPlayers = await ctx.db
    .query("players")
    .withIndex("by_tournament", (q: any) => q.eq("tournamentId", stage.tournamentId))
    .collect();

  const matches = await ctx.db
    .query("matches")
    .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
    .collect();

  const matchPlayerIds = new Set<string>();
  for (const m of matches) {
    if (m.player1Id) matchPlayerIds.add(m.player1Id);
    if (m.player2Id) matchPlayerIds.add(m.player2Id);
  }

  const anyHasGroupId = allPlayers.some((p: any) => p.groupId !== undefined);
  let players: any[];
  if (anyHasGroupId) {
    players = allPlayers.filter((p: any) => p.groupId === groupId || matchPlayerIds.has(p._id));
  } else if (matchPlayerIds.size > 0) {
    players = allPlayers.filter((p: any) => matchPlayerIds.has(p._id));
  } else {
    const allGroups = await ctx.db
      .query("groups")
      .withIndex("by_stage", (q: any) => q.eq("stageId", stage._id))
      .collect();
    if (allGroups.length <= 1) {
      players = allPlayers;
    } else {
      players = [];
    }
  }

  players.sort((a: any, b: any) => (a.groupSlotIndex ?? 0) - (b.groupSlotIndex ?? 0));
  const playerIds = players.map((p: any) => p._id);
  const playerMap = new Map<string, any>(players.map((p: any) => [p._id, p]));

  const matchInputs: MatchResultInput[] = matches.map((m: any) => ({
    player1Id: m.player1Id as string,
    player2Id: m.player2Id as string,
    sets: m.sets,
    status: m.status,
    winnerId: m.winnerId as string | undefined,
  }));

  // Invoke Pure Algorithmic Engine with 7-step recursive tiebreakers
  const standings = calculateStandings(playerIds as string[], matchInputs, pointsRule);

  return standings.map((s) => {
    const p: any = playerMap.get(s.playerId as string);
    return {
      ...s,
      name: p?.name ?? "Nieznany",
      groupSlotIndex: p?.groupSlotIndex ?? 0,
      checkedIn: p?.checkedIn ?? false,
    };
  });
}

// 1. GET GROUP STANDINGS
export const getGroupStandings = query({
  args: {
    groupId: v.id("groups"),
    pointsRuleOverride: v.optional(
      v.union(v.literal("2_1_matrix"), v.literal("standard_3_1_0"))
    ),
  },
  handler: async (ctx: any, args: any) => {
    return calculateGroupStandingsInternal(ctx, args.groupId, args.pointsRuleOverride);
  },
});

// 2. GET ALL TOURNAMENT STANDINGS (For Spectator Portal & Kiosk)
export const getTournamentStandings = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx: any, args: any) => {
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", args.tournamentId))
      .collect();

    const groupStages = stages.filter((s: any) => s.type === "group");
    const result: Record<string, { groupName: string; standings: any[] }> = {};

    for (const stage of groupStages) {
      const groups = await ctx.db
        .query("groups")
        .withIndex("by_stage", (q: any) => q.eq("stageId", stage._id))
        .collect();

      for (const g of groups) {
        const standings = await calculateGroupStandingsInternal(ctx, g._id);
        result[g._id] = {
          groupName: g.name,
          standings,
        };
      }
    }

    return result;
  },
});
