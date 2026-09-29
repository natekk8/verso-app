import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import * as tournaments from "../../../convex/tournaments";
import * as players from "../../../convex/players";
import * as matches from "../../../convex/matches";
import * as standings from "../../../convex/standings";
import * as slides from "../../../convex/slides";
import * as seed from "../../../convex/seed";

// Simple in-memory Convex database emulator for direct handler testing
function createTestDb() {
  const tables: Record<string, Map<string, any>> = {
    tournaments: new Map(),
    sportRules: new Map(),
    days: new Map(),
    pitches: new Map(),
    stages: new Map(),
    groups: new Map(),
    players: new Map(),
    matches: new Map(),
    qualificationRules: new Map(),
    slides: new Map(),
  };

  let idCounter = 1;

  const db = {
    async insert(table: string, value: any) {
      const _id = `${table}_${idCounter++}`;
      const doc = { _id, _creationTime: Date.now(), ...value };
      tables[table].set(_id, doc);
      return _id;
    },
    async get(id: string) {
      for (const table of Object.values(tables)) {
        if (table.has(id)) return { ...table.get(id) };
      }
      return null;
    },
    async patch(id: string, updates: any) {
      for (const table of Object.values(tables)) {
        if (table.has(id)) {
          const doc = table.get(id);
          Object.assign(doc, updates);
          return;
        }
      }
      throw new Error(`Document ${id} not found to patch`);
    },
    async delete(id: string) {
      for (const table of Object.values(tables)) {
        if (table.delete(id)) return;
      }
    },
    query(table: string) {
      const docs = Array.from(tables[table].values());
      let filtered = [...docs];

      const queryBuilder = {
        withIndex(indexName: string, filterFn?: (q: any) => any) {
          if (filterFn) {
            const filterObj: Record<string, any> = {};
            const q = {
              eq(field: string, val: any) {
                filterObj[field] = val;
                return q;
              },
            };
            filterFn(q);
            filtered = docs.filter((d) => {
              return Object.entries(filterObj).every(([k, v]) => d[k] === v);
            });
          }
          return queryBuilder;
        },
        async collect() {
          return [...filtered];
        },
        async first() {
          return filtered[0] ?? null;
        },
      };

      return queryBuilder;
    },
  };

  return { ctx: { db }, tables };
}

describe("Convex Database Schema (10 Tables)", () => {
  it("defines all 10 required tables with indexes in convex/schema.ts", () => {
    expect(schema).toBeDefined();
    // schema.tables contains table definitions
    const tableKeys = Object.keys((schema as any).tables);
    const requiredTables = [
      "tournaments",
      "sportRules",
      "days",
      "pitches",
      "stages",
      "groups",
      "players",
      "matches",
      "qualificationRules",
      "slides",
    ];

    requiredTables.forEach((tableName) => {
      expect(tableKeys).toContain(tableName);
    });
    expect(tableKeys).toHaveLength(10);
  });
});

describe("Convex Backend Functions (tournaments, players, matches, standings, slides, seed)", () => {
  it("executes complete tournament lifecycle across backend functions", async () => {
    const { ctx, tables } = createTestDb();

    // 1. Create Tournament
    const createResult = await (tournaments.create as any)._handler(ctx, {
      name: "Mistrzostwa Testowe",
      slug: "mistrzostwa-testowe",
      sportPreset: "table_tennis",
      days: [{ date: "2026-10-02", order: 1 }],
      pitches: [{ name: "Stół 1", order: 1 }, { name: "Stół 2", order: 2 }],
      allowPlayerScoreSubmission: true,
    });

    expect(createResult.tournamentId).toBeDefined();
    expect(createResult.slug).toBe("mistrzostwa-testowe");
    expect(createResult.adminSecret).toBeDefined();
    const tId = createResult.tournamentId;
    const adminSec = createResult.adminSecret;

    // 2. Safe Public Lookup (Never exposes adminSecret)
    const publicData = await (tournaments.getBySlug as any)._handler(ctx, {
      slug: "mistrzostwa-testowe",
    });
    expect(publicData).not.toBeNull();
    expect(publicData.slug).toBe("mistrzostwa-testowe");
    expect(publicData.adminSecret).toBeUndefined();
    expect(publicData.sportRules).toBeDefined();
    expect(publicData.sportRules.preset).toBe("table_tennis");

    // 3. Verify Admin Secret
    const authValid = await (tournaments.verifyAdminSecret as any)._handler(ctx, {
      slug: "mistrzostwa-testowe",
      adminSecret: adminSec,
    });
    expect(authValid.valid).toBe(true);

    const authInvalid = await (tournaments.verifyAdminSecret as any)._handler(ctx, {
      slug: "mistrzostwa-testowe",
      adminSecret: "wrong_key",
    });
    expect(authInvalid.valid).toBe(false);

    // 4. Register 9 Players
    const playerNames = [
      "Antek Sadowski",
      "Bartek Kalarus",
      "Filip Kruszka",
      "Filip Szata",
      "Franek Herka",
      "Igor Mądry",
      "Leon Marycki",
      "Michał Krzakiewicz",
      "Tomasz Borówka",
    ];

    const bulkRes = await (players.bulkCreate as any)._handler(ctx, {
      tournamentId: tId,
      adminSecret: adminSec,
      players: playerNames.map((name, idx) => ({
        name,
        groupSlotIndex: idx,
        secretCode: `sec-p-${idx + 1}`,
      })),
    });
    expect(bulkRes.createdCount).toBe(9);

    const playerList = await (players.listByTournament as any)._handler(ctx, {
      tournamentId: tId,
    });
    expect(playerList).toHaveLength(9);
    expect(playerList[8].name).toBe("Tomasz Borówka");
    expect(playerList[8].groupSlotIndex).toBe(8);

    // 5. Generate Berger Matches for Group Stage (9 players => 9 rounds of 4 matches = 36 matches)
    const stagesList = await ctx.db
      .query("stages")
      .withIndex("by_tournament", (q: any) => q.eq("tournamentId", tId))
      .collect();
    const groupStage = stagesList[0];

    const groupsList = await ctx.db
      .query("groups")
      .withIndex("by_stage", (q: any) => q.eq("stageId", groupStage._id))
      .collect();
    const groupA = groupsList[0];

    const schedRes = await (matches.generateFromSchedule as any)._handler(ctx, {
      tournamentId: tId,
      adminSecret: adminSec,
      stageId: groupStage._id,
      groupId: groupA._id,
      autoSchedulePitchesAndTime: true,
      matchDurationMinutes: 20,
      restIntervalMinutes: 10,
    });
    expect(schedRes.generatedCount).toBe(36);
    expect(schedRes.roundsCount).toBe(9);

    // 6. Update Match Score by Admin
    const matchList = await (matches.listByTournament as any)._handler(ctx, {
      tournamentId: tId,
    });
    expect(matchList).toHaveLength(36);
    const firstMatch = matchList[0];

    const scoreUpdate = await (matches.updateScore as any)._handler(ctx, {
      matchId: firstMatch._id,
      adminSecret: adminSec,
      sets: [
        { s1: 11, s2: 7 },
        { s1: 11, s2: 9 },
      ],
    });
    expect(scoreUpdate.success).toBe(true);
    expect(scoreUpdate.status).toBe("completed");
    expect(scoreUpdate.winnerId).toBe(firstMatch.player1Id);

    // 7. Player Score Submission Gate Test
    const p1 = playerList[0];
    const p2 = playerList[1];
    const matchForP1 = matchList.find(
      (m: any) => m._id !== firstMatch._id && (m.player1Id === p1._id || m.player2Id === p1._id)
    );
    expect(matchForP1).toBeDefined();

    const pSubmitRes = await (matches.submitPlayerScore as any)._handler(ctx, {
      matchId: matchForP1._id,
      playerSecret: p1.secretCode,
      sets: [
        { s1: 8, s2: 11 },
        { s1: 11, s2: 6 },
        { s1: 15, s2: 13 },
      ],
    });
    expect(pSubmitRes.success).toBe(true);
    expect(pSubmitRes.status).toBe("completed");

    // 8. Standings Calculation with 2_1_matrix
    const standingsList = await (standings.getGroupStandings as any)._handler(ctx, {
      groupId: groupA._id,
    });
    expect(standingsList).toHaveLength(9);
    expect(standingsList[0].rank).toBe(1);
    expect(standingsList[0].name).toBeDefined();

    // 9. Knockout Stage Generation
    const koRes = await (matches.generateKnockoutStage as any)._handler(ctx, {
      tournamentId: tId,
      adminSecret: adminSec,
      stageName: "Drabinka B",
      qualifierCount: 4,
      includeThirdPlace: true,
    });
    expect(koRes.matchCount).toBe(4);

    // 10. Presenter Kiosk Data
    const presenterData = await (slides.getPresenterData as any)._handler(ctx, {
      slug: "mistrzostwa-testowe",
    });
    expect(presenterData).not.toBeNull();
    expect(presenterData.tournament.name).toBe("Mistrzostwa Testowe");
    expect(presenterData.slideConfig).toBeDefined();
    expect(presenterData.standings).toHaveLength(9);
  });

  it("restores the full FSS showcase tournament with 9 players, 5 dates, 2 pitches, and 40 matches in convex/seed.ts", async () => {
    const { ctx, tables } = createTestDb();

    const seedRes = await (seed.restoreFssShowcase as any)._handler(ctx);
    expect(seedRes.success).toBe(true);
    expect(seedRes.slug).toBe("mistrzostwa-1v1-fss");
    expect(seedRes.playersCount).toBe(9);
    expect(seedRes.matchesCount).toBe(40);

    expect(tables.tournaments.size).toBe(1);
    expect(tables.players.size).toBe(9);
    expect(tables.days.size).toBe(5);
    expect(tables.pitches.size).toBe(2);
    expect(tables.stages.size).toBe(2);
    expect(tables.groups.size).toBe(1);
    expect(tables.matches.size).toBe(40);
    expect(tables.slides.size).toBe(1);

    const tomasz = Array.from(tables.players.values()).find((p: any) => p.name === "Tomasz Borówka");
    expect(tomasz).toBeDefined();
    expect(tomasz.groupSlotIndex).toBe(8);
  });
});
