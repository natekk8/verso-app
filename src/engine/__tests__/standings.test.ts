import { describe, it, expect } from "vitest";
import { calculateStandings, MatchResultInput } from "../standings";

describe("Recursive Tiebreaker Standings Engine", () => {
  const players = ["player-a", "player-b", "player-c", "player-d"];

  describe("FSS 2:0 / 2:1 Sets Scoring Matrix", () => {
    it("awards 2 pts for 2:0 win and 0 pts to loser", () => {
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [
            { s1: 11, s2: 8 },
            { s1: 11, s2: 9 },
          ],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      const a = standings.find((s) => s.playerId === "player-a")!;
      const b = standings.find((s) => s.playerId === "player-b")!;

      expect(a.points).toBe(2);
      expect(a.won).toBe(1);
      expect(a.setsWon).toBe(2);
      expect(a.setsLost).toBe(0);
      expect(a.setDifference).toBe(2);

      expect(b.points).toBe(0);
      expect(b.lost).toBe(1);
      expect(b.setsWon).toBe(0);
      expect(b.setsLost).toBe(2);
      expect(b.setDifference).toBe(-2);
    });

    it("awards 2 pts to winner and 1 pt to loser in 2:1 match", () => {
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [
            { s1: 11, s2: 8 },
            { s1: 9, s2: 11 },
            { s1: 15, s2: 13 },
          ],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      const a = standings.find((s) => s.playerId === "player-a")!;
      const b = standings.find((s) => s.playerId === "player-b")!;

      expect(a.points).toBe(2);
      expect(a.won).toBe(1);
      expect(a.setsWon).toBe(2);
      expect(a.setsLost).toBe(1);

      expect(b.points).toBe(1); // Loser won 1 set -> gets 1 point!
      expect(b.lost).toBe(1);
      expect(b.setsWon).toBe(1);
      expect(b.setsLost).toBe(2);
    });
  });

  describe("Tier 1: Overall Points", () => {
    it("ranks player with more points higher", () => {
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: "player-a",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      expect(standings[0].playerId).toBe("player-a");
      expect(standings[0].points).toBe(4);
      expect(standings[0].rank).toBe(1);
    });
  });

  describe("Tier 2: Head-to-Head (Direct 2-way tie)", () => {
    it("resolves 2-way tie on points using direct match result", () => {
      // Both A and B end up with 2 points:
      // A beat B 2:0 (+2 pts for A)
      // B beat C 2:0 (+2 pts for B)
      // C beat A 2:0 (+2 pts for C) -- wait, that would be 3-way.
      // Let's create an external match so both A and B have 2 points, but A beat B directly:
      // A beat B 2:0 (A: 2 pts, B: 0 pts)
      // B beat D 2:0 (B: 2 pts, D: 0 pts)
      // C beat A 2:0 (C: 2 pts, A: 2 pts)
      // Now A and B both have 2 points. D has 0. C has 2.
      // Wait, let's keep C out of it:
      const matches: MatchResultInput[] = [
        // A beats B directly
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
          status: "completed",
        },
        // B beats D
        {
          player1Id: "player-b",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
          status: "completed",
        },
        // D beats A
        {
          player1Id: "player-d",
          player2Id: "player-a",
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
          status: "completed",
        },
      ];
      // A: beat B (2 pts), lost to D (0 pts) -> 2 pts
      // B: lost to A (0 pts), beat D (2 pts) -> 2 pts
      // D: lost to B (0 pts), beat A (2 pts) -> 2 pts
      // Wait! That's a 3-way tie.
      // Let's make an exact 2-way tie between A and B:
      // A and B both beat D 2:0 (A has 2 pts, B has 2 pts).
      // A also beat B 2:1! (A gets +2 pts -> 4 pts, B gets +1 pt -> 3 pts).
      // To keep them tied on points:
      // A beat B 2:0 (A: 2, B: 0)
      // B beat C 2:0 (B: 2, C: 0)
      // B beat D 2:0 (B: 4, D: 0)
      // A beat C 2:0 (A: 4, C: 0)
      // Now A: 4 pts, B: 4 pts! C: 0 pts, D: 0 pts.
      const twoWayMatches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 6 }, { s1: 11, s2: 7 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: "player-a",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      // A: 2 matches, 2 wins = 4 pts.
      // B: 3 matches, 2 wins, 1 loss = 4 pts.
      // A and B tied at 4 pts.
      // In their direct match: A beat B 2:0.
      const standings = calculateStandings(players, twoWayMatches, "2_1_matrix");
      expect(standings[0].playerId).toBe("player-a");
      expect(standings[1].playerId).toBe("player-b");
      expect(standings[0].rank).toBe(1);
      expect(standings[1].rank).toBe(2);
      expect(standings[0].tiebreakerExplanation).toContain("Head-to-Head win");
    });
  });

  describe("Tier 2 & Recursion: 3-way Tie with Mini-League", () => {
    it("partitions 3 tied players via mini-league points", () => {
      const fivePlayers = ["player-a", "player-b", "player-c", "player-d", "player-e"];
      // A, B, C all finish with 4 overall points:
      // In mini-league {A, B, C}:
      // - A beats B (2:0) -> A gets 2 pts
      // - A beats C (2:0) -> A gets 2 pts (A mini-pts: 4)
      // - B beats C (2:0) -> B gets 2 pts (B mini-pts: 2, C mini-pts: 0)
      // Outside mini-league:
      // - D beats A (2:0) -> A overall pts = 4
      // - B beats D (2:0) -> B overall pts = 4
      // - C beats D (2:0) -> C gets 2 pts
      // - C beats E (2:0) -> C gets 2 pts -> C overall pts = 4
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-a",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-d",
          player2Id: "player-a",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-c",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-c",
          player2Id: "player-e",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(fivePlayers, matches, "2_1_matrix");

      // Verify all 3 top players have 4 overall points
      const top3 = standings.slice(0, 3);
      expect(top3.every((s) => s.points === 4)).toBe(true);

      // Mini-league separates: A is 1st (4 mini-pts), B is 2nd (2 mini-pts), C is 3rd (0 mini-pts)
      expect(standings[0].playerId).toBe("player-a");
      expect(standings[1].playerId).toBe("player-b");
      expect(standings[2].playerId).toBe("player-c");
      expect(standings[3].playerId).toBe("player-d");
      expect(standings[4].playerId).toBe("player-e");
    });

    it("handles circular 3-way tie falling through to overall set difference and recursing for remaining 2", () => {
      // Circular tie:
      // A beats B (2:0) [22:16 points]
      // B beats C (2:0) [22:16 points]
      // C beats A (2:0) [22:16 points]
      // Mini-league points: A (2), B (2), C (2).
      // Mini-league sets: all 2-2 (diff 0).
      // Mini-league points scored: all identical (diff 0).
      // Mini-league cannot separate them!
      // Now, outside the mini-league against player D:
      // A beats D 2:0 (overall sets for A: 4-2, diff +2)
      // B beats D 2:1 (overall sets for B: 4-3, diff +1)
      // C beats D 2:1 (overall sets for C: 4-3, diff +1)
      // Total points:
      // A: 2 (beat B) + 2 (beat D) = 4 pts. Set diff = +2.
      // B: 2 (beat C) + 2 (beat D) = 4 pts. Set diff = +1.
      // C: 2 (beat A) + 2 (beat D) = 4 pts. Set diff = +1.
      // Step 4 (Overall Set Difference) separates A (+2) from {B, C} (+1)!
      // A gets Rank 1!
      // The remaining subset {B, C} has 2 players, so RECURSIVE RESTART triggers H2H between B and C!
      // In their direct match: B beat C 2:0!
      // So B gets Rank 2, and C gets Rank 3!
      const circularMatches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-c",
          player2Id: "player-a",
          sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }],
          status: "completed",
        },
        {
          player1Id: "player-a",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: "player-b",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 5 }, { s1: 9, s2: 11 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: "player-c",
          player2Id: "player-d",
          sets: [{ s1: 11, s2: 5 }, { s1: 9, s2: 11 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, circularMatches, "2_1_matrix");

      expect(standings[0].playerId).toBe("player-a"); // Separated by overall set diff (+2)
      expect(standings[1].playerId).toBe("player-b"); // Beat C in direct H2H!
      expect(standings[2].playerId).toBe("player-c");
      expect(standings[3].playerId).toBe("player-d");
    });
  });

  describe("Standard 3-1-0 Points Rule", () => {
    it("correctly awards 3 pts for win and 0 for loss", () => {
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 5 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(players, matches, "standard_3_1_0");
      expect(standings[0].playerId).toBe("player-a");
      expect(standings[0].points).toBe(3);
      expect(standings[1].points).toBe(0);
    });
  });

  describe("Edge cases and non-completed matches", () => {
    it("ignores pending and in_progress matches", () => {
      const matches: MatchResultInput[] = [
        {
          player1Id: "player-a",
          player2Id: "player-b",
          sets: [{ s1: 11, s2: 5 }],
          status: "pending",
        },
        {
          player1Id: "player-a",
          player2Id: "player-c",
          sets: [{ s1: 11, s2: 5 }],
          status: "in_progress",
        },
      ];

      const standings = calculateStandings(players, matches, "2_1_matrix");
      standings.forEach((s) => {
        expect(s.played).toBe(0);
        expect(s.points).toBe(0);
      });
    });

    it("handles zero matches cleanly", () => {
      const standings = calculateStandings(players, [], "2_1_matrix");
      expect(standings).toHaveLength(4);
      expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
    });
  });
});
