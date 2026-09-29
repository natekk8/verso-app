import { mutation } from "./_generated/server";
import { generateBergerSchedule } from "../src/engine/berger";
import { scheduleTournamentMatches, MatchInput, PitchConfig, DayConfig } from "../src/engine/scheduler";
import { generateKnockoutBracket } from "../src/engine/knockout";

export const FSS_PLAYERS = [
  { name: "Antek Sadowski", slotIndex: 0, secretCode: "sec-antek-01" },
  { name: "Bartek Kalarus", slotIndex: 1, secretCode: "sec-bartek-02" },
  { name: "Filip Kruszka", slotIndex: 2, secretCode: "sec-kruszka-03" },
  { name: "Filip Szata", slotIndex: 3, secretCode: "sec-szata-04" },
  { name: "Franek Herka", slotIndex: 4, secretCode: "sec-franek-05" },
  { name: "Igor Mądry", slotIndex: 5, secretCode: "sec-igor-06" },
  { name: "Leon Marycki", slotIndex: 6, secretCode: "sec-leon-07" },
  { name: "Michał Krzakiewicz", slotIndex: 7, secretCode: "sec-michal-08" },
  { name: "Tomasz Borówka", slotIndex: 8, secretCode: "sec-tomasz-09" },
];

export const FSS_DATES = [
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-16",
  "2026-10-17",
];

export const FSS_PITCHES = [
  { name: "Stół 1", order: 1 },
  { name: "Stół 2", order: 2 },
];

export const FSS_SPORT_RULES = {
  preset: "table_tennis" as const,
  singularUnit: "Set",
  pluralUnit: "Sety",
  targetPointsPerUnit: 11,
  unitsToWinMatch: 2,
  hasDeciderTiebreak: true,
  deciderThreshold: 1,
  deciderPoints: 15,
  winByTwo: true,
  pointsRule: "2_1_matrix" as const,
};

export const restoreFssShowcase = mutation({
  args: {},
  handler: async (ctx: any) => {
    const slug = "mistrzostwa-1v1-fss";

    // 1. Delete existing tournament with this slug if any
    const existing = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();
    if (existing) {
      const tId = existing._id;
      for (const table of [
        "players",
        "days",
        "pitches",
        "stages",
        "groups",
        "matches",
        "slides",
        "qualificationRules",
      ] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tId))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      if (existing.sportRulesId) {
        await ctx.db.delete(existing.sportRulesId);
      }
      await ctx.db.delete(tId);
    }

    // 2. Insert Sport Rules
    const sportRulesId = await ctx.db.insert("sportRules", {
      ...FSS_SPORT_RULES,
    });

    // 3. Insert Tournament
    const tournamentId = await ctx.db.insert("tournaments", {
      name: "Mistrzostwa 1v1 FSS",
      slug,
      adminSecret: "fss-admin-2026",
      sportRulesId,
      allowPlayerScoreSubmission: true,
      createdAt: Date.now(),
    });

    // 4. Insert 5 Dates
    const dayIds: { id: any; date: string }[] = [];
    for (let i = 0; i < FSS_DATES.length; i++) {
      const dId = await ctx.db.insert("days", {
        tournamentId,
        date: FSS_DATES[i],
        order: i + 1,
      });
      dayIds.push({ id: dId, date: FSS_DATES[i] });
    }

    // 5. Insert 2 Pitches
    const pitchIds: { id: any; name: string; order: number }[] = [];
    for (const p of FSS_PITCHES) {
      const pId = await ctx.db.insert("pitches", {
        tournamentId,
        name: p.name,
        order: p.order,
      });
      pitchIds.push({ id: pId, name: p.name, order: p.order });
    }

    // 6. Insert 9 Players
    const playerIds: any[] = [];
    for (const p of FSS_PLAYERS) {
      const plId = await ctx.db.insert("players", {
        tournamentId,
        name: p.name,
        secretCode: p.secretCode,
        groupSlotIndex: p.slotIndex,
        checkedIn: true,
      });
      playerIds.push(plId);
    }

    // 7. Insert Stages: Grupa A (Group) & Drabinka B (Knockout)
    const stage1Id = await ctx.db.insert("stages", {
      tournamentId,
      type: "group",
      name: "Grupa A",
      order: 1,
    });
    const group1Id = await ctx.db.insert("groups", {
      stageId: stage1Id,
      tournamentId,
      name: "Grupa A",
    });

    const stage2Id = await ctx.db.insert("stages", {
      tournamentId,
      type: "knockout",
      name: "Drabinka B",
      order: 2,
    });

    // 8. Generate 36 Group Matches
    const bergerRounds = generateBergerSchedule(9);
    const rawMatches: MatchInput[] = [];
    for (const r of bergerRounds) {
      for (const m of r.matches) {
        if (!m.isBye) {
          rawMatches.push({
            id: `fss-g-${rawMatches.length + 1}`,
            round: r.roundNumber,
            player1Id: playerIds[m.player1Slot],
            player2Id: playerIds[m.player2Slot],
            stageId: stage1Id,
            groupId: group1Id,
          });
        }
      }
    }

    const pitchConfigs: PitchConfig[] = pitchIds.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.order,
    }));

    const dayConfigs: DayConfig[] = dayIds.map((d) => ({
      id: d.id,
      date: d.date,
      startTime: "18:00",
    }));

    const scheduledGroupMatches = scheduleTournamentMatches(
      rawMatches,
      pitchConfigs,
      dayConfigs,
      { matchDurationMinutes: 20, restIntervalMinutes: 10 }
    );

    for (let i = 0; i < scheduledGroupMatches.length; i++) {
      const sm = scheduledGroupMatches[i];
      await ctx.db.insert("matches", {
        tournamentId,
        stageId: stage1Id,
        groupId: group1Id,
        dayId: sm.dayId,
        pitchId: sm.pitchId,
        time: sm.startTime,
        endTime: sm.endTime,
        startTimestamp: sm.startTimestamp,
        endTimestamp: sm.endTimestamp,
        roundNumber: sm.round,
        matchInRound: (i % 4) + 1,
        player1Id: sm.player1Id,
        player2Id: sm.player2Id,
        sets: [],
        status: "pending",
      });
    }

    // 9. Generate 4 Knockout Matches (Semifinals, 3rd place, Final)
    const knockoutTree = generateKnockoutBracket(4, true);
    for (const km of knockoutTree) {
      const matchId = await ctx.db.insert("matches", {
        tournamentId,
        stageId: stage2Id,
        roundNumber: km.roundName === "semifinals" ? 1 : 2,
        roundName: km.roundName,
        knockoutMatchId: km.id,
        sets: [],
        status: "pending",
        slot1Source: km.slot1
          ? { sourceType: km.slot1.sourceType, sourceRef: km.slot1.sourceRef }
          : undefined,
        slot2Source: km.slot2
          ? { sourceType: km.slot2.sourceType, sourceRef: km.slot2.sourceRef }
          : undefined,
      });

      if (km.slot1?.sourceType === "group_rank") {
        await ctx.db.insert("qualificationRules", {
          tournamentId,
          sourceGroupId: group1Id,
          sourceRank: parseInt(km.slot1.sourceRef.split(".")[0], 10) || 1,
          targetMatchId: matchId,
          targetSlot: "slot1",
          description: `${km.slot1.sourceRef} -> ${km.id} (slot1)`,
        });
      }
      if (km.slot2?.sourceType === "group_rank") {
        await ctx.db.insert("qualificationRules", {
          tournamentId,
          sourceGroupId: group1Id,
          sourceRank: parseInt(km.slot2.sourceRef.split(".")[0], 10) || 2,
          targetMatchId: matchId,
          targetSlot: "slot2",
          description: `${km.slot2.sourceRef} -> ${km.id} (slot2)`,
        });
      }
    }

    // 10. Insert Slides Config
    await ctx.db.insert("slides", {
      tournamentId,
      rotationIntervalSeconds: 10,
      announcementText: "Faza pucharowa rozpoczyna się 17 października!",
      activeSlides: ["standings", "matches", "announcements"],
    });

    return {
      success: true,
      tournamentId,
      slug,
      adminSecret: "fss-admin-2026",
      playersCount: 9,
      matchesCount: 40,
    };
  },
});
