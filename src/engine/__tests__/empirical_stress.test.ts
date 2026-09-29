import { describe, it, expect } from "vitest";
import { calculateStandings, MatchResultInput } from "../standings";
import {
  scheduleTournamentMatches,
  validateScheduleIntegrity,
  MatchInput,
  PitchConfig,
  DayConfig,
} from "../scheduler";
import { generateBergerSchedule } from "../berger";

describe("CHALLENGER EMPIRICAL STRESS TEST SUITE", () => {
  // =========================================================================
  // 1. STANDINGS TIEBREAKER STRESS TESTS
  // =========================================================================
  describe("1. Standings Tiebreaker Stress Tests", () => {
    const p = (id: string) => `player-${id}`;

    it("1.1 Strict Hierarchy: Tier 1 (Points) overrides Tier 2 (Head-to-Head)", () => {
      // Player A has 4 points, Player B has 2 points.
      // But B beat A in their direct H2H match!
      // Engine MUST rank A above B because overall points takes precedence over H2H.
      const players = [p("a"), p("b"), p("c")];
      const matches: MatchResultInput[] = [
        // B beats A 2:0 -> B gets 2 pts, A gets 0 pts
        {
          player1Id: p("b"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        // A beats C 2:0 -> A gets 2 pts
        {
          player1Id: p("a"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        // A beats C again 2:0 -> A gets 2 pts (total A: 4 pts)
        {
          player1Id: p("a"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      expect(standings[0].playerId).toBe(p("a"));
      expect(standings[0].points).toBe(4);
      expect(standings[1].playerId).toBe(p("b"));
      expect(standings[1].points).toBe(2);
      expect(standings[2].playerId).toBe(p("c"));
      expect(standings[2].points).toBe(0);
    });

    it("1.2 Strict Hierarchy: Tier 2 (H2H) overrides Tier 3 (Matches Won)", () => {
      // In 2_1_matrix:
      // Player A: 1 win (2:0 = 2 pts), 2 losses in 3 sets (1:2 = 1 pt each -> 2 pts). Total: 4 pts, 1 win.
      // Player B: 2 wins (2:0 = 2 pts each -> 4 pts), 1 loss (0:2 = 0 pts). Total: 4 pts, 2 wins.
      // A and B tied at 4 pts.
      // But in their direct H2H match: A beat B 2:0!
      // Engine MUST rank A above B by H2H, even though B has 2 wins and A has only 1 win!
      const players = [p("a"), p("b"), p("c"), p("d")];
      const matches: MatchResultInput[] = [
        // A beats B 2:0 directly -> A: 2 pts, B: 0 pts
        {
          player1Id: p("a"),
          player2Id: p("b"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        // B beats C 2:0 -> B: 2 pts
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        // B beats D 2:0 -> B: 2 pts (total B: 4 pts, 2 wins)
        {
          player1Id: p("b"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        // C beats A 2:1 -> A gets 1 pt, C gets 2 pts
        {
          player1Id: p("c"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        // D beats A 2:1 -> A gets 1 pt, D gets 2 pts (total A: 4 pts, 1 win)
        {
          player1Id: p("d"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      const a = standings.find((s) => s.playerId === p("a"))!;
      const b = standings.find((s) => s.playerId === p("b"))!;

      expect(a.points).toBe(4);
      expect(b.points).toBe(4);
      expect(a.won).toBe(1);
      expect(b.won).toBe(2);

      // A must be ranked ahead of B because A won H2H!
      expect(a.rank).toBeLessThan(b.rank);
      expect(a.tiebreakerExplanation).toContain("Head-to-Head win vs player-b");
    });

    it("1.3 Strict Hierarchy: Tier 4 (Set Difference) overrides Tier 5 (Point Difference)", () => {
      // 3-way circular tie where H2H and Matches Won are tied.
      // Outside matches give different set differences:
      // Player A has set diff +3, but pt diff +10.
      // Player B has set diff +4, but pt diff +5.
      // Engine MUST rank B above A because set difference (+4 > +3) overrides point difference (+10 vs +5).
      const players = [p("a"), p("b"), p("c"), p("d")];
      const matches: MatchResultInput[] = [
        // 3-way cycle {A, B, C}: all 2:0 with identical 11-9 scores
        {
          player1Id: p("a"),
          player2Id: p("b"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: p("c"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        // Versus D:
        // A beats D 2:0 with massive points: sets +2, pt diff: 22 - 2 = +20. Overall set diff: 4 - 2 = +2.
        {
          player1Id: p("a"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 1 }, { s1: 11, s2: 1 }],
          status: "completed",
        },
        // B plays D twice! Beats D 2:0 and 2:0 with modest points: sets +4.
        // Wait, to keep overall points tied:
        // Let's use standard_3_1_0 or 2_1_matrix:
        // In 2_1_matrix, both A and B can have 4 points total:
        // A: beat B (2), beat D (2) -> 4 pts. Overall sets: 2-0 + 2-0 - (0-2 to C) = 4-2 (+2).
        // B: beat C (2), beat D (2) -> 4 pts.
        // What if B beat D 2:0 (sets +2) and A beat D 2:1 (sets +1)?
        // Then B has overall set diff +2, A has overall set diff +1.
        // But in point difference, A could have scored huge in his 2:1 match!
      ];

      // Clean test for Set Diff vs Point Diff:
      // Two players A and B with NO direct match (or direct match was a tie/unplayed):
      const twoPlayers = [p("a"), p("b"), p("c")];
      const setVsPtMatches: MatchResultInput[] = [
        // A vs C: A wins 2:1 (sets: 2-1 = +1). Points: 11-0, 0-11, 11-0 -> A points: 22, C points: 11 (+11 pt diff).
        {
          player1Id: p("a"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 0 }, { s1: 0, s2: 11 }, { s1: 11, s2: 0 }],
          status: "completed",
        },
        // B vs C: B wins 2:0 (sets: 2-0 = +2). Points: 11-9, 11-9 -> B points: 22, C points: 18 (+4 pt diff).
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
      ];

      // A: 2 pts, 1 win, set diff +1, pt diff +11
      // B: 2 pts, 1 win, set diff +2, pt diff +4
      // No H2H between A and B!
      // B MUST beat A on set difference (+2 > +1) even though A has higher point difference (+11 > +4)!
      const standings = calculateStandings(twoPlayers, setVsPtMatches, "2_1_matrix");
      expect(standings[0].playerId).toBe(p("b"));
      expect(standings[0].setDifference).toBe(2);
      expect(standings[1].playerId).toBe(p("a"));
      expect(standings[1].setDifference).toBe(1);
      expect(standings[0].rank).toBe(1);
      expect(standings[1].rank).toBe(2);
    });

    it("1.4 Strict Hierarchy: Tier 5 (Point Difference) breaks tie when Points, H2H, Wins, Set Diff are identical", () => {
      const players = [p("a"), p("b"), p("c")];
      // A and B both play C, no direct match between A and B:
      // A beats C 2:0 with 11-3, 11-3 -> set diff +2, pt diff +16
      // B beats C 2:0 with 11-8, 11-8 -> set diff +2, pt diff +6
      const matches: MatchResultInput[] = [
        {
          player1Id: p("a"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 3 }, { s1: 11, s2: 3 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      expect(standings[0].playerId).toBe(p("a"));
      expect(standings[0].pointDifference).toBe(16);
      expect(standings[1].playerId).toBe(p("b"));
      expect(standings[1].pointDifference).toBe(6);
      expect(standings[0].rank).toBe(1);
      expect(standings[1].rank).toBe(2);
      expect(standings[0].tiebreakerExplanation).toContain("point difference");
    });

    it("1.5 Complex 3-Way Circular Tie (A beats B, B beats C, C beats A) resolved by Point Difference", () => {
      const players = [p("a"), p("b"), p("c"), p("d")];
      // A beats B (2:0) 11-2, 11-2  (pt diff vs B: +18)
      // B beats C (2:0) 11-6, 11-6  (pt diff vs C: +10)
      // C beats A (2:0) 11-9, 11-9  (pt diff vs A: +4)
      // Mini-league stats:
      // A: sets 2-2 (0), pt diff: +18 - 4 = +14
      // B: sets 2-2 (0), pt diff: -18 + 10 = -8
      // C: sets 2-2 (0), pt diff: -10 + 4 = -6
      // All 3 have 2 mini-points, 1 win, set diff 0.
      // Mini-league point difference: A (+14) is 1st!
      // Remaining subset {C, B}: C has -6, B has -8. C is 2nd! B is 3rd!
      // Plus each beats D 2:0 with identical 11-5, 11-5 scores.
      const matches: MatchResultInput[] = [
        {
          player1Id: p("a"),
          player2Id: p("b"),
          sets: [{ s1: 11, s2: 2 }, { s1: 11, s2: 2 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 6 }, { s1: 11, s2: 6 }],
          status: "completed",
        },
        {
          player1Id: p("c"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: p("a"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: p("c"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");

      expect(standings[0].playerId).toBe(p("a"));
      expect(standings[1].playerId).toBe(p("c"));
      expect(standings[2].playerId).toBe(p("b"));
      expect(standings[3].playerId).toBe(p("d"));

      expect(standings[0].rank).toBe(1);
      expect(standings[1].rank).toBe(2);
      expect(standings[2].rank).toBe(3);
      expect(standings[3].rank).toBe(4);
    });

    it("1.6 Complex 4-Way Multi-Tie: 4 players tied on points with cascading resolution", () => {
      const players = [p("a"), p("b"), p("c"), p("d"), p("e")];
      // 4 players {A, B, C, D} all finish with 4 points:
      // A beats B (2:0)
      // B beats C (2:0)
      // C beats D (2:0)
      // D beats A (2:0)
      // Mini-league {A, B, C, D}: all have 1 win, 1 loss, 2 pts each.
      // Now let external player E play against them:
      // A beats E 2:0 (sets: 11-1, 11-1 -> pt diff +20)
      // B beats E 2:0 (sets: 11-5, 11-5 -> pt diff +12)
      // C beats E 2:0 (sets: 11-7, 11-7 -> pt diff +8)
      // D beats E 2:0 (sets: 11-9, 11-9 -> pt diff +4)
      // Total points for all 4 is 4 pts.
      // Mini-league matches are all identical 11-8, 11-8 (diff 0).
      // Overall set diff for all 4 is 4-2 (+2).
      // Overall point diff separates all 4:
      // A: +20, B: +12, C: +8, D: +4.
      const matches: MatchResultInput[] = [
        {
          player1Id: p("a"),
          player2Id: p("b"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("c"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: p("c"),
          player2Id: p("d"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: p("d"),
          player2Id: p("a"),
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: p("a"),
          player2Id: p("e"),
          sets: [{ s1: 11, s2: 1 }, { s1: 11, s2: 1 }],
          status: "completed",
        },
        {
          player1Id: p("b"),
          player2Id: p("e"),
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: p("c"),
          player2Id: p("e"),
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
          status: "completed",
        },
        {
          player1Id: p("d"),
          player2Id: p("e"),
          sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");

      expect(standings.map((s) => s.playerId)).toEqual([
        p("a"),
        p("b"),
        p("c"),
        p("d"),
        p("e"),
      ]);
      expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
    });

    it("1.7 Absolute Determinism: 100 identical evaluations produce 100 identical standings", () => {
      const players = [p("x"), p("y"), p("z"), p("w")];
      const matches: MatchResultInput[] = [
        {
          player1Id: p("x"),
          player2Id: p("y"),
          sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 15, s2: 13 }],
          status: "completed",
        },
        {
          player1Id: p("z"),
          player2Id: p("w"),
          sets: [{ s1: 11, s2: 0 }, { s1: 11, s2: 0 }],
          status: "completed",
        },
      ];

      const baseline = calculateStandings(players, matches, "2_1_matrix");
      for (let i = 0; i < 100; i++) {
        const trial = calculateStandings(players, matches, "2_1_matrix");
        expect(trial).toEqual(baseline);
      }
    });

    it("1.8 Robustness: Empty players, uncompleted matches, and extreme inputs do not crash", () => {
      expect(() => calculateStandings([], [])).not.toThrow();
      expect(calculateStandings([], [])).toEqual([]);

      const single = calculateStandings(["p1"], []);
      expect(single).toHaveLength(1);
      expect(single[0].rank).toBe(1);

      // Extreme scores
      const extremeMatches: MatchResultInput[] = [
        {
          player1Id: "p1",
          player2Id: "p2",
          sets: [{ s1: 9999, s2: 9998 }],
          status: "completed",
        },
        {
          player1Id: "p1",
          player2Id: "p3",
          sets: [],
          status: "in_progress",
        },
      ];
      expect(() => calculateStandings(["p1", "p2", "p3"], extremeMatches)).not.toThrow();
    });
  });

  // =========================================================================
  // 2. PITCH & TIME SCHEDULER STRESS TESTS (100 SIMULATIONS)
  // =========================================================================
  describe("2. Pitch & Time Scheduler Stress Testing (100 Random Schedules)", () => {
    it("simulates 100 random schedules across varying pitch counts (1, 2, 4, 8) and participant counts (4 to 20)", () => {
      const pitchCounts = [1, 2, 4, 8];
      const startTimes = ["08:00", "09:30", "14:00", "18:00"];
      const durations = [15, 20, 30];
      const restIntervals = [5, 10, 15, 20];

      let totalSimulations = 0;
      let totalMatchesScheduled = 0;

      for (let sim = 1; sim <= 100; sim++) {
        // Deterministic pseudo-random generation based on sim index
        const participantCount = 4 + (sim % 17); // 4 to 20
        const pitchCount = pitchCounts[sim % pitchCounts.length]; // 1, 2, 4, 8
        const matchDuration = durations[sim % durations.length]; // 15, 20, 30
        const restInterval = restIntervals[sim % restIntervals.length]; // 5, 10, 15, 20
        const dayCount = 1 + (sim % 5); // 1 to 5 days
        const startTime = startTimes[sim % startTimes.length];

        // 1. Build Pitches
        const pitches: PitchConfig[] = [];
        for (let pIdx = 1; pIdx <= pitchCount; pIdx++) {
          pitches.push({
            id: `pitch-${pIdx}`,
            name: `Table ${pIdx}`,
            order: pIdx,
          });
        }

        // 2. Build Days
        const days: DayConfig[] = [];
        for (let dIdx = 1; dIdx <= dayCount; dIdx++) {
          const dateStr = `2026-10-${dIdx.toString().padStart(2, "0")}`;
          days.push({
            id: `day-${dIdx}`,
            date: dateStr,
            startTime,
          });
        }

        // 3. Generate Berger matches for participantCount
        const rounds = generateBergerSchedule(participantCount);
        const matches: MatchInput[] = [];
        let matchCounter = 1;
        for (const r of rounds) {
          for (const m of r.matches) {
            matches.push({
              id: `sim${sim}-m${matchCounter++}`,
              round: m.round,
              player1Id: `p-${m.player1Slot}`,
              player2Id: `p-${m.player2Slot}`,
            });
          }
        }

        // 4. Run Scheduler
        const scheduled = scheduleTournamentMatches(matches, pitches, days, {
          matchDurationMinutes: matchDuration,
          restIntervalMinutes: restInterval,
        });

        totalSimulations++;
        totalMatchesScheduled += scheduled.length;

        // All matches must be scheduled
        expect(scheduled.length).toBe(matches.length);

        // 5. Automated Integrity QA Check
        const integrity = validateScheduleIntegrity(scheduled, restInterval);

        if (!integrity.isValid) {
          console.error(`FAILURE at Sim #${sim}:`, {
            participantCount,
            pitchCount,
            matchDuration,
            restInterval,
            dayCount,
            pitchOverlaps: integrity.pitchOverlaps,
            playerOverlaps: integrity.playerOverlaps,
            restViolations: integrity.restViolations,
          });
        }

        expect(integrity.pitchOverlaps).toEqual([]);
        expect(integrity.playerOverlaps).toEqual([]);
        expect(integrity.restViolations).toEqual([]);
        expect(integrity.isValid).toBe(true);

        // 6. Independent Adversarial Assertion Checks
        // Verify no pitch overlap independently:
        for (let i = 0; i < scheduled.length; i++) {
          for (let j = i + 1; j < scheduled.length; j++) {
            const m1 = scheduled[i];
            const m2 = scheduled[j];

            if (m1.date === m2.date && m1.pitchId === m2.pitchId) {
              const overlap =
                m1.startTimestamp < m2.endTimestamp && m2.startTimestamp < m1.endTimestamp;
              expect(overlap).toBe(false);
            }

            // Verify no player concurrency
            if (m1.date === m2.date) {
              const hasSharedPlayer =
                m1.player1Id === m2.player1Id ||
                m1.player1Id === m2.player2Id ||
                m1.player2Id === m2.player1Id ||
                m1.player2Id === m2.player2Id;

              if (hasSharedPlayer) {
                const overlap =
                  m1.startTimestamp < m2.endTimestamp && m2.startTimestamp < m1.endTimestamp;
                expect(overlap).toBe(false);

                // Verify rest interval
                const gapMs =
                  m1.startTimestamp < m2.startTimestamp
                    ? m2.startTimestamp - m1.endTimestamp
                    : m1.startTimestamp - m2.endTimestamp;
                const gapMinutes = gapMs / (1000 * 60);
                expect(gapMinutes).toBeGreaterThanOrEqual(restInterval);
              }
            }
          }
        }
      }

      expect(totalSimulations).toBe(100);
      expect(totalMatchesScheduled).toBeGreaterThan(5000);
    });
  });
});
