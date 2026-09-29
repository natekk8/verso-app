import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import * as tournaments from "../../../convex/tournaments";
import * as players from "../../../convex/players";
import * as matches from "../../../convex/matches";
import * as standings from "../../../convex/standings";
import * as slides from "../../../convex/slides";
import * as seed from "../../../convex/seed";
import { MockConvexStore } from "../convex-client";
import { calculateStandings, MatchResultInput } from "../../engine/standings";

// In-memory Convex database emulator for direct handler testing
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

describe("CHALLENGER M2-1 EMPIRICAL BACKEND STRESS TEST SUITE", () => {
  // ==========================================================================
  // Section 1: Boundary & Adversarial Match Mutations
  // ==========================================================================
  describe("1. Boundary & Adversarial Score Mutations", () => {
    it("rejects negative set scores in updateScore and submitPlayerScore", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Adv Test",
        slug: "adv-test",
        sportPreset: "table_tennis",
        allowPlayerScoreSubmission: true,
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // Admin negative score
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          adminSecret: t.adminSecret,
          sets: [{ s1: -1, s2: 11 }],
        })
      ).rejects.toThrow();

      // Player negative score
      await expect(
        (matches.submitPlayerScore as any)._handler(ctx, {
          matchId: mId,
          playerSecret: "sec-1",
          sets: [{ s1: 11, s2: -5 }],
        })
      ).rejects.toThrow();
    });

    it("rejects invalid win-by-2 margins (diff > 2 when max > target)", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "WinByTwo Test",
        slug: "win-by-two-test",
        sportPreset: "table_tennis", // target 11, winByTwo: true
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // 14:11 is invalid because in win-by-2, game terminates at 13:11
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          adminSecret: t.adminSecret,
          sets: [{ s1: 14, s2: 11 }, { s1: 11, s2: 0 }],
        })
      ).rejects.toThrow(/In win-by-2/);
    });

    it("rejects extraneous sets submitted after match was already decided", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Extraneous Sets Test",
        slug: "extra-sets-test",
        sportPreset: "table_tennis", // unitsToWinMatch: 2
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // Player 1 won sets 1 and 2 (2:0), submitting 3rd set must be rejected
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          adminSecret: t.adminSecret,
          sets: [
            { s1: 11, s2: 9 },
            { s1: 11, s2: 8 },
            { s1: 11, s2: 5 }, // extraneous!
          ],
        })
      ).rejects.toThrow(/Extraneous set/);
    });

    it("enforces decider tiebreak threshold and points (15 pts at 1:1)", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Decider Test",
        slug: "decider-test",
        sportPreset: "table_tennis", // deciderPoints: 15 at 1:1
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // In set 3 at 1:1, game played to only 11 instead of 15 is incomplete (not completed)
      const resIncomplete = await (matches.updateScore as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        sets: [
          { s1: 11, s2: 9 },
          { s1: 9, s2: 11 },
          { s1: 11, s2: 9 }, // Only 11 points in decider that requires 15!
        ],
      });
      // Should remain in_progress, NOT completed
      expect(resIncomplete.status).toBe("in_progress");
      expect(resIncomplete.winnerId).toBeUndefined();

      // With 15 points, it completes
      const resComplete = await (matches.updateScore as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        sets: [
          { s1: 11, s2: 9 },
          { s1: 9, s2: 11 },
          { s1: 15, s2: 13 },
        ],
      });
      expect(resComplete.status).toBe("completed");
      expect(resComplete.winnerId).toBe(pRes.playerIds[0]);
    });

    it("resets match to pending when empty sets array is provided", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Reset Test",
        slug: "reset-test",
        sportPreset: "table_tennis",
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 8 }],
        status: "completed",
        winnerId: pRes.playerIds[0],
      });

      const resetRes = await (matches.updateScore as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        sets: [],
      });
      expect(resetRes.status).toBe("pending");
      expect(resetRes.winnerId).toBeUndefined();

      const doc = await ctx.db.get(mId);
      expect(doc.status).toBe("pending");
      expect(doc.sets).toEqual([]);
      expect(doc.winnerId).toBeUndefined();
    });
  });

  // ==========================================================================
  // Section 2: Walkover Verification & Edge Cases
  // ==========================================================================
  describe("2. Walkovers & Forfeits", () => {
    it("sets correct walkover sets (2:0 target points) and awards winner", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Walkover Test",
        slug: "walkover-test",
        sportPreset: "table_tennis",
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      const woRes = await (matches.setWalkover as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        winnerPlayerId: pRes.playerIds[0],
      });
      expect(woRes.success).toBe(true);
      expect(woRes.winnerId).toBe(pRes.playerIds[0]);

      const doc = await ctx.db.get(mId);
      expect(doc.status).toBe("completed");
      expect(doc.walkover).toBe(true);
      expect(doc.winnerId).toBe(pRes.playerIds[0]);
      expect(doc.sets).toEqual([
        { s1: 11, s2: 0 },
        { s1: 11, s2: 0 },
      ]);
    });

    it("EMPIRICAL CHECK: setWalkover with an alien player ID (player not in match)", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Alien Walkover Test",
        slug: "alien-walkover-test",
        sportPreset: "table_tennis",
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
          { name: "AlienPlayer3", secretCode: "sec-3", groupSlotIndex: 2 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // Test whether convex/matches.ts setWalkover rejects an alien winner (player not in match)
      const alienId = pRes.playerIds[2];
      await expect(
        (matches.setWalkover as any)._handler(ctx, {
          matchId: mId,
          adminSecret: t.adminSecret,
          winnerPlayerId: alienId,
        })
      ).rejects.toThrow(/participant/i);

      // Verify that valid participant in match succeeds
      await (matches.setWalkover as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        winnerPlayerId: pRes.playerIds[0],
      });
      const patchedMatch = await ctx.db.get(mId);
      expect(patchedMatch.winnerId).toBe(pRes.playerIds[0]);
    });

    it("blocks player score submission against an already walkover-completed match", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Walkover Lock Test",
        slug: "wo-lock-test",
        sportPreset: "table_tennis",
        allowPlayerScoreSubmission: true,
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // Set walkover
      await (matches.setWalkover as any)._handler(ctx, {
        matchId: mId,
        adminSecret: t.adminSecret,
        winnerPlayerId: pRes.playerIds[1],
      });

      // Player 1 tries to submit score to overwrite walkover
      await expect(
        (matches.submitPlayerScore as any)._handler(ctx, {
          matchId: mId,
          playerSecret: "sec-1",
          sets: [{ s1: 11, s2: 0 }, { s1: 11, s2: 0 }],
        })
      ).rejects.toThrow(/Match is already completed/);
    });
  });

  // ==========================================================================
  // Section 3: Security Gates & Permission Enforcement
  // ==========================================================================
  describe("3. Security Gates & Permissions", () => {
    it("Gate 1: blocks player submission when allowPlayerScoreSubmission is false", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Permission Gate Test",
        slug: "gate-test",
        sportPreset: "table_tennis",
        allowPlayerScoreSubmission: false, // Disabled!
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      await expect(
        (matches.submitPlayerScore as any)._handler(ctx, {
          matchId: mId,
          playerSecret: "sec-1",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/disabled by tournament organizer/);
    });

    it("Gate 2: blocks player submission with invalid secret token", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Invalid Token Test",
        slug: "invalid-token-test",
        sportPreset: "table_tennis",
        allowPlayerScoreSubmission: true,
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      await expect(
        (matches.submitPlayerScore as any)._handler(ctx, {
          matchId: mId,
          playerSecret: "wrong-fake-secret",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/Invalid player secret token/);
    });

    it("Gate 3: blocks non-participating player from submitting score for another match", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Non-Participant Test",
        slug: "non-part-test",
        sportPreset: "table_tennis",
        allowPlayerScoreSubmission: true,
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
          { name: "P3", secretCode: "sec-3", groupSlotIndex: 2 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // Player 3 attempts to submit score for match between P1 and P2
      await expect(
        (matches.submitPlayerScore as any)._handler(ctx, {
          matchId: mId,
          playerSecret: "sec-3",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/Player cannot submit scores for matches they are not participating in/);
    });

    it("EMPIRICAL CHECK: refereeSecret validation behavior in updateScore", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Referee Check Test",
        slug: "ref-check-test",
        sportPreset: "table_tennis",
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "sec-1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "sec-2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // 1. Calling updateScore with NO credentials should fail
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/Unauthorized/);

      // 2. Calling updateScore with empty refereeSecret should fail
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          refereeSecret: "",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/Unauthorized/);

      // 3. Calling updateScore with arbitrary arbitrary-referee-string must be rejected
      await expect(
        (matches.updateScore as any)._handler(ctx, {
          matchId: mId,
          refereeSecret: "arbitrary-random-string",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }],
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("EMPIRICAL CHECK: Inspect public queries for credential leaks (adminSecret and secretCode)", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Leak Check Test",
        slug: "leak-check-test",
        sportPreset: "table_tennis",
      });

      const pRes = await (players.bulkCreate as any)._handler(ctx, {
        tournamentId: t.tournamentId,
        adminSecret: t.adminSecret,
        players: [
          { name: "P1", secretCode: "super-secret-p1", groupSlotIndex: 0 },
          { name: "P2", secretCode: "super-secret-p2", groupSlotIndex: 1 },
        ],
      });

      const mId = await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        player1Id: pRes.playerIds[0],
        player2Id: pRes.playerIds[1],
        roundNumber: 1,
        sets: [],
        status: "pending",
      });

      // 1. getBySlug properly hides adminSecret
      const pubSlug = await (tournaments.getBySlug as any)._handler(ctx, { slug: "leak-check-test" });
      expect(pubSlug.adminSecret).toBeUndefined();

      // 2. matches:listByTournament attaches player objects with secretCode sanitized
      const publicMatches = await (matches.listByTournament as any)._handler(ctx, {
        tournamentId: t.tournamentId,
      });
      expect(publicMatches).toHaveLength(1);
      // Public spectator cannot read player secret token
      const leakedSecret = publicMatches[0].player1?.secretCode;
      expect(leakedSecret).toBeUndefined();

      // 3. players:listByTournament returns secretCode directly
      const playerList = await (players.listByTournament as any)._handler(ctx, {
        tournamentId: t.tournamentId,
      });
      expect(playerList[0].secretCode).toBe("super-secret-p1");
    });
  });

  // ==========================================================================
  // Section 4: Multi-Way Cyclic Tiebreakers in Standings
  // ==========================================================================
  describe("4. Multi-Way Cyclic Tiebreakers", () => {
    it("correctly resolves a 3-way cyclic tie (A > B > C > A) using point difference", () => {
      const playerIds = ["pA", "pB", "pC"];
      // A beats B 2-0 (11-5, 11-5) => A +12 ptDiff, B -12
      // B beats C 2-0 (11-7, 11-7) => B +8 ptDiff, C -8
      // C beats A 2-0 (11-9, 11-9) => C +4 ptDiff, A -4
      // Total mini ptDiff:
      // A: +12 - 4 = +8
      // B: -12 + 8 = -4
      // C: -8 + 4 = -4
      // A has +8 (1st), then B vs C: B beat C head-to-head (2nd), C (3rd)
      const matchesInput: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
          winnerId: "pA",
        },
        {
          player1Id: "pB",
          player2Id: "pC",
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
          status: "completed",
          winnerId: "pB",
        },
        {
          player1Id: "pC",
          player2Id: "pA",
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
          winnerId: "pC",
        },
      ];

      const standingsResult = calculateStandings(playerIds, matchesInput, "2_1_matrix");
      expect(standingsResult).toHaveLength(3);
      expect(standingsResult[0].playerId).toBe("pA");
      expect(standingsResult[1].playerId).toBe("pB");
      expect(standingsResult[2].playerId).toBe("pC");
    });

    it("gracefully resolves an absolute 3-way tie (identical scores) without infinite loop", () => {
      const playerIds = ["pA", "pB", "pC"];
      // Perfect circle with identical set and point scores:
      // A beats B 2-0 (11-9, 11-9)
      // B beats C 2-0 (11-9, 11-9)
      // C beats A 2-0 (11-9, 11-9)
      const matchesInput: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
          winnerId: "pA",
        },
        {
          player1Id: "pB",
          player2Id: "pC",
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
          winnerId: "pB",
        },
        {
          player1Id: "pC",
          player2Id: "pA",
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
          winnerId: "pC",
        },
      ];

      const standingsResult = calculateStandings(playerIds, matchesInput, "2_1_matrix");
      expect(standingsResult).toHaveLength(3);
      // All stats are identical (2 pts, 1 win, 0 setDiff, 0 ptDiff, 40 pts won)
      // Must fall back to initial registration order [pA, pB, pC] deterministically
      expect(standingsResult[0].playerId).toBe("pA");
      expect(standingsResult[1].playerId).toBe("pB");
      expect(standingsResult[2].playerId).toBe("pC");
      expect(standingsResult[0].points).toBe(2);
      expect(standingsResult[1].points).toBe(2);
      expect(standingsResult[2].points).toBe(2);
    });

    it("EMPIRICAL CHECK: multi-group player isolation in convex/standings.ts", async () => {
      const { ctx } = createTestDb();
      const t = await (tournaments.create as any)._handler(ctx, {
        name: "Multi-Group Isolation Test",
        slug: "multi-group-test",
        sportPreset: "table_tennis",
      });

      // Create Group A and Group B
      const stage = (await ctx.db.query("stages").withIndex("by_tournament", (q: any) => q.eq("tournamentId", t.tournamentId)).collect())[0];
      const groupA = (await ctx.db.query("groups").withIndex("by_stage", (q: any) => q.eq("stageId", stage._id)).collect())[0];
      const groupBId = await ctx.db.insert("groups", {
        stageId: stage._id,
        tournamentId: t.tournamentId,
        name: "Grupa B",
      });

      // 2 players in Group A, 2 players in Group B
      const p1 = await ctx.db.insert("players", { tournamentId: t.tournamentId, name: "P1_GA", groupId: groupA._id, groupSlotIndex: 0, secretCode: "s1", checkedIn: true });
      const p2 = await ctx.db.insert("players", { tournamentId: t.tournamentId, name: "P2_GA", groupId: groupA._id, groupSlotIndex: 1, secretCode: "s2", checkedIn: true });
      const p3 = await ctx.db.insert("players", { tournamentId: t.tournamentId, name: "P3_GB", groupId: groupBId, groupSlotIndex: 2, secretCode: "s3", checkedIn: true });
      const p4 = await ctx.db.insert("players", { tournamentId: t.tournamentId, name: "P4_GB", groupId: groupBId, groupSlotIndex: 3, secretCode: "s4", checkedIn: true });

      // Group A match
      await ctx.db.insert("matches", {
        tournamentId: t.tournamentId,
        stageId: stage._id,
        groupId: groupA._id,
        roundNumber: 1,
        player1Id: p1,
        player2Id: p2,
        sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }],
        status: "completed",
        winnerId: p1,
      });

      // Standings for Group A
      const standingsGA = await (standings.getGroupStandings as any)._handler(ctx, {
        groupId: groupA._id,
      });

      // Verified: Group A standings only contains the 2 Group A players
      expect(standingsGA).toHaveLength(2);
      expect(standingsGA.some((s: any) => s.name === "P3_GB")).toBe(false);
    });
  });

  // ==========================================================================
  // Section 5: MockConvexStore Parity & Authorization Tests
  // ==========================================================================
  describe("5. MockConvexStore Parity & Authorization Checks", () => {
    it("EMPIRICAL CHECK: Mock store updateScore rejects calls without admin or referee secret", async () => {
      const store = new MockConvexStore(false);
      const matchesList = Array.from(store.matches.values());
      const pendingMatch = matchesList.find((m) => m.status === "pending")!;

      // Execute mutation with NO adminSecret and NO refereeSecret must throw Unauthorized error
      await expect(
        store.executeMutation("matches:updateScore", {
          matchId: pendingMatch._id,
          sets: [{ s1: 11, s2: 0 }, { s1: 11, s2: 0 }],
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("EMPIRICAL CHECK: Mock store setWalkover supports both winnerPlayerId and winnerId with authorization", async () => {
      const store = new MockConvexStore(false);
      const matchesList = Array.from(store.matches.values());
      const pendingMatch = matchesList.find((m) => m.status === "pending")!;

      // When called with winnerPlayerId and adminSecret:
      const updated = await store.executeMutation("matches:setWalkover", {
        matchId: pendingMatch._id,
        winnerPlayerId: pendingMatch.player1Id,
        adminSecret: "adm_fss_secret_2026",
      });
      expect(updated.status).toBe("completed");
      expect(updated.winnerId).toBe(pendingMatch.player1Id);
    });
  });
});
