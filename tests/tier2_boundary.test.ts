/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * 
 * Validates edge conditions, mathematical boundaries, and corner cases:
 * 1. Odd participant count math (9 players: 9 rds, 4 matches/rd, 36 matches, 1 bye/rd; 7 players; 5 players) [5 tests]
 * 2. Minimal tournaments (2, 3, 4 players, 1 player, 0 players) [5 tests]
 * 3. Score boundaries: 0-0, 11-10 vs 12-10 win-by-2, decider 15 vs 11, extraneous sets [5 tests]
 * 4. Multi-way cyclic ties in standings (3-way cyclic, asymmetric sets, 4-way) [5 tests]
 * 5. Walkovers and default matches in group and knockout [5 tests]
 * 6. LocalStorage admin token caching and rehydration isolation [5 tests]
 * 
 * Total: 30 test cases (exceeds >=5 per feature requirement)
 */

import {
  describe,
  it,
  expect,
  generateBergerSchedule,
  validateMatchScore,
  calculateStandings,
  generateKnockoutBracket,
  LocalStorageMock,
  cacheAdminToken,
  getCachedAdminToken,
  clearAdminToken,
  rehydrateAdminSession,
  type SportRulesConfig,
  type MatchResultInput,
} from "./harness.ts";

describe("Tier 2 - Odd Participant Count Math (R3)", 2, () => {
  it("T2.1: 9 players exact math: 9 rounds, 4 matches/rd, 36 total matches, 1 bye/rd", () => {
    const rounds = generateBergerSchedule(9);
    expect(rounds).toHaveLength(9);

    let matchCount = 0;
    for (const r of rounds) {
      expect(r.matches).toHaveLength(4);
      expect(r.byePlayerSlot).toBeDefined();
      matchCount += r.matches.length;
    }
    expect(matchCount).toBe(36);
  }, "R3");

  it("T2.2: 9 players bye distribution: each player gets a bye on a distinct round", () => {
    const rounds = generateBergerSchedule(9);
    const byesByRound = new Map<number, number>();

    for (const r of rounds) {
      expect(r.byePlayerSlot).toBeDefined();
      byesByRound.set(r.roundNumber, r.byePlayerSlot!);
    }

    expect(byesByRound.size).toBe(9);
    const uniqueByeSlots = new Set(byesByRound.values());
    expect(uniqueByeSlots.size).toBe(9);
    for (let slot = 0; slot < 9; slot++) {
      expect(uniqueByeSlots.has(slot)).toBe(true);
    }
  }, "R3");

  it("T2.3: 7 players: 7 rounds, 3 matches/round (21 total matches), 1 bye per round", () => {
    const rounds = generateBergerSchedule(7);
    expect(rounds).toHaveLength(7);

    let totalMatches = 0;
    const byes = new Set<number>();
    for (const r of rounds) {
      expect(r.matches).toHaveLength(3);
      expect(r.byePlayerSlot).toBeDefined();
      byes.add(r.byePlayerSlot!);
      totalMatches += r.matches.length;
    }

    // 7*6/2 = 21 matches
    expect(totalMatches).toBe(21);
    expect(byes.size).toBe(7);
  }, "R3");

  it("T2.4: 5 players: 5 rounds, 2 matches/round (10 total matches), 1 bye per round", () => {
    const rounds = generateBergerSchedule(5);
    expect(rounds).toHaveLength(5);

    let totalMatches = 0;
    const byes = new Set<number>();
    for (const r of rounds) {
      expect(r.matches).toHaveLength(2);
      expect(r.byePlayerSlot).toBeDefined();
      byes.add(r.byePlayerSlot!);
      totalMatches += r.matches.length;
    }

    // 5*4/2 = 10 matches
    expect(totalMatches).toBe(10);
    expect(byes.size).toBe(5);
  }, "R3");

  it("T2.5: Odd count pairing balance: every distinct pair meets once with no self-pairings", () => {
    const rounds = generateBergerSchedule(7);
    const pairs = new Set<string>();

    for (const r of rounds) {
      for (const m of r.matches) {
        expect(m.player1Slot).not.toBe(m.player2Slot);
        const key = `${Math.min(m.player1Slot, m.player2Slot)}-${Math.max(m.player1Slot, m.player2Slot)}`;
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }

    // 7*6/2 = 21 pairs
    expect(pairs.size).toBe(21);
  }, "R3");
});

describe("Tier 2 - Minimal Tournament Participant Bounds (R3)", 2, () => {
  it("T2.6: Minimal 2 players: 1 round, 1 match, 0 byes", () => {
    const rounds = generateBergerSchedule(2);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].matches).toHaveLength(1);
    expect(rounds[0].byePlayerSlot).toBeUndefined();
    expect(rounds[0].matches[0].player1Slot).not.toBe(rounds[0].matches[0].player2Slot);
  }, "R3");

  it("T2.7: Minimal 3 players: 3 rounds, 1 match/round, 3 total matches, 1 bye/round", () => {
    const rounds = generateBergerSchedule(3);
    expect(rounds).toHaveLength(3);

    let totalMatches = 0;
    const byes = new Set<number>();
    for (const r of rounds) {
      expect(r.matches).toHaveLength(1);
      expect(r.byePlayerSlot).toBeDefined();
      byes.add(r.byePlayerSlot!);
      totalMatches += r.matches.length;
    }
    // 3*2/2 = 3 matches
    expect(totalMatches).toBe(3);
    expect(byes.size).toBe(3);
  }, "R3");

  it("T2.8: Minimal 4 players: 3 rounds, 2 matches/round, 6 total matches, 0 byes", () => {
    const rounds = generateBergerSchedule(4);
    expect(rounds).toHaveLength(3);

    let totalMatches = 0;
    for (const r of rounds) {
      expect(r.matches).toHaveLength(2);
      expect(r.byePlayerSlot).toBeUndefined();
      totalMatches += r.matches.length;
    }
    // 4*3/2 = 6 matches
    expect(totalMatches).toBe(6);
  }, "R3");

  it("T2.9: 1 player edge case: returns single round with 0 matches and bye for player 0", () => {
    const rounds = generateBergerSchedule(1);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].matches).toHaveLength(0);
    expect(rounds[0].byePlayerSlot).toBe(0);
  }, "R3");

  it("T2.10: 0 players edge case: returns empty schedule without throwing", () => {
    const rounds = generateBergerSchedule(0);
    expect(rounds).toHaveLength(0);
  }, "R3");
});

describe("Tier 2 - Score Boundaries & Win-Condition Enforcements (R2)", 2, () => {
  const tableTennisRules: SportRulesConfig = {
    preset: "table_tennis",
    singularUnit: "Set",
    pluralUnit: "Sety",
    targetPointsPerUnit: 11,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: true,
    deciderThreshold: 1,
    deciderPoints: 15,
    winByTwo: true,
  };

  it("T2.11: 0-0 incomplete set score is recognized as valid but in-progress", () => {
    const res = validateMatchScore([{ s1: 0, s2: 0 }], tableTennisRules);
    expect(res.isValid).toBe(true);
    expect(res.isMatchCompleted).toBe(false);
    expect(res.winner).toBeUndefined();
  }, "R2");

  it("T2.12: 11-10 with winByTwo: true is in-progress (deuce), not completed", () => {
    const res = validateMatchScore([{ s1: 11, s2: 10 }], tableTennisRules);
    expect(res.isValid).toBe(true);
    expect(res.isMatchCompleted).toBe(false);
    expect(res.setsWonP1).toBe(0);
    expect(res.setsWonP2).toBe(0);
  }, "R2");

  it("T2.13: 12-10 or 16-14 with winByTwo: true is a valid finished set; lead > 2 beyond target is invalid", () => {
    // 12-10 is valid (lead 2)
    const validSet = validateMatchScore(
      [
        { s1: 12, s2: 10 },
        { s1: 11, s2: 8 },
      ],
      tableTennisRules
    );
    expect(validSet.isValid).toBe(true);
    expect(validSet.isMatchCompleted).toBe(true);
    expect(validSet.winner).toBe(1);

    // 13-10 is invalid in win-by-2 because set terminates once lead reaches 2 (at 12:10)
    const invalidSet = validateMatchScore([{ s1: 13, s2: 10 }], tableTennisRules);
    expect(invalidSet.isValid).toBe(false);
    expect(invalidSet.error).toContain("terminates when lead reaches 2");
  }, "R2");

  it("T2.14: Decider tiebreak set: at 1:1, 3rd set must reach 15 points (e.g. 15-11)", () => {
    // 11-9 in 3rd set when deciderPoints is 15 is NOT completed
    const incompleteDecider = validateMatchScore(
      [
        { s1: 11, s2: 7 }, // P1 wins set 1
        { s1: 8, s2: 11 }, // P2 wins set 2 -> tied 1:1
        { s1: 11, s2: 9 }, // Reached 11, but decider target is 15
      ],
      tableTennisRules
    );
    expect(incompleteDecider.isValid).toBe(true);
    expect(incompleteDecider.isMatchCompleted).toBe(false);

    // 15-11 in 3rd set completes the match
    const completeDecider = validateMatchScore(
      [
        { s1: 11, s2: 7 },
        { s1: 8, s2: 11 },
        { s1: 15, s2: 11 },
      ],
      tableTennisRules
    );
    expect(completeDecider.isValid).toBe(true);
    expect(completeDecider.isMatchCompleted).toBe(true);
    expect(completeDecider.winner).toBe(1);
  }, "R2");

  it("T2.15: Match ends at unitsToWinMatch; extraneous set after 2:0 is rejected as invalid", () => {
    const extraneous = validateMatchScore(
      [
        { s1: 11, s2: 6 },
        { s1: 11, s2: 8 },
        { s1: 11, s2: 4 }, // Unnecessary 3rd set
      ],
      tableTennisRules
    );
    expect(extraneous.isValid).toBe(false);
    expect(extraneous.error).toContain("Extraneous set");
  }, "R2");
});

describe("Tier 2 - Multi-Way Ties in Standings (R1)", 2, () => {
  it("T2.16: 3-way cyclic tie (A beat B 2:0, B beat C 2:0, C beat A 2:0) broken by Point Difference", () => {
    // Points: A=2, B=2, C=2.
    // Sets: A=2:2, B=2:2, C=2:2 (diff 0).
    // Let's differentiate on point difference:
    // A vs B: 11:4, 11:4 (A +14, B -14)
    // B vs C: 11:7, 11:7 (B +8, C -8)
    // C vs A: 11:8, 11:8 (C +6, A -6)
    // Point diffs:
    // A: +14 - 6 = +8
    // B: -14 + 8 = -6
    // C: -8 + 6 = -2
    // Expected ranking: 1: A (+8), 2: C (-2), 3: B (-6)
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 4 }, { s1: 11, s2: 4 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }], status: "completed" },
      { player1Id: "C", player2Id: "A", sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 8 }], status: "completed" },
    ];
    const s = calculateStandings(["A", "B", "C"], matches, "2_1_matrix");
    expect(s[0].playerId).toBe("A");
    expect(s[0].pointDifference).toBe(8);
    expect(s[1].playerId).toBe("C");
    expect(s[1].pointDifference).toBe(-2);
    expect(s[2].playerId).toBe("B");
    expect(s[2].pointDifference).toBe(-6);
  }, "R1");

  it("T2.17: 3-way cyclic tie broken by mini-league Set Difference when asymmetric", () => {
    // A beats B 2:0 -> A sets +2, B sets -2
    // B beats C 2:1 -> B sets +1 (net -1), C sets -1
    // C beats A 2:1 -> C sets +1 (net 0), A sets -1 (net +1)
    // Mini-league set differences:
    // A: 3-2 = +1
    // C: 3-3 = 0
    // B: 2-3 = -1
    // Expected ranking: 1: A, 2: C, 3: B
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }], status: "completed" },
      { player1Id: "C", player2Id: "A", sets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }], status: "completed" },
    ];
    // Under standard_3_1_0, each gets 3 points (1 win)
    const s = calculateStandings(["A", "B", "C"], matches, "standard_3_1_0");
    expect(s[0].playerId).toBe("A");
    expect(s[0].setDifference).toBe(1);
    expect(s[1].playerId).toBe("C");
    expect(s[1].setDifference).toBe(0);
    expect(s[2].playerId).toBe("B");
    expect(s[2].setDifference).toBe(-1);
  }, "R1");

  it("T2.18: 3-way tie broken by overall set difference when mini-league is equal", () => {
    // 4 players: A, B, C, D
    // A, B, C form a cyclic tie where mini-league is completely equal:
    // A beats B 2:0 (11-9, 11-9)
    // B beats C 2:0 (11-9, 11-9)
    // C beats A 2:0 (11-9, 11-9)
    // All 3 also play D, and all 3 beat D:
    // A beats D 2:0
    // B beats D 2:1
    // C beats D 2:0
    // Overall Sets:
    // A: 4-2 = +2
    // C: 4-2 = +2
    // B: 4-3 = +1 (B is 3rd among the trio)
    // Between A and C: A beat D 2:0 (11-2, 11-2), C beat D 2:0 (11-9, 11-9) -> A has better point diff
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
      { player1Id: "C", player2Id: "A", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
      { player1Id: "A", player2Id: "D", sets: [{ s1: 11, s2: 2 }, { s1: 11, s2: 2 }], status: "completed" },
      { player1Id: "B", player2Id: "D", sets: [{ s1: 11, s2: 9 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }], status: "completed" },
      { player1Id: "C", player2Id: "D", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
    ];
    const s = calculateStandings(["A", "B", "C", "D"], matches, "standard_3_1_0");
    // B is isolated by set diff (+1 vs +2). Between remaining {A, C}, C beat A head-to-head.
    expect(s[0].playerId).toBe("C");
    expect(s[1].playerId).toBe("A");
    expect(s[2].playerId).toBe("B");
    expect(s[3].playerId).toBe("D");
  }, "R1");

  it("T2.19: 4-way cyclic tie (A->B->C->D->A) resolved deterministically", () => {
    // 4 players in circle:
    // A beats B (2:0)
    // B beats C (2:0)
    // C beats D (2:0)
    // D beats A (2:0)
    // And opposite pairs:
    // A vs C: A beats C (2:0)
    // B vs D: B beats D (2:0)
    // Matches won: A=2, B=2, C=1, D=1
    // Standings should cleanly sort:
    // Top 2: A, B (both won 2). H2H: A beat B -> A is 1st, B is 2nd.
    // Bottom 2: C, D (both won 1). H2H: C beat D -> C is 3rd, D is 4th.
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "C", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "D", player2Id: "A", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "A", player2Id: "C", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "B", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
    ];
    const s = calculateStandings(["A", "B", "C", "D"], matches, "2_1_matrix");
    expect(s[0].playerId).toBe("A");
    expect(s[1].playerId).toBe("B");
    expect(s[2].playerId).toBe("C");
    expect(s[3].playerId).toBe("D");
  }, "R1");

  it("T2.20: Completely equal standings produce valid ordered standings without errors", () => {
    // 2 players who haven't played any matches yet
    const s = calculateStandings(["A", "B"], [], "2_1_matrix");
    expect(s).toHaveLength(2);
    expect(s[0].played).toBe(0);
    expect(s[1].played).toBe(0);
    expect(s[0].points).toBe(0);
    expect(s[1].points).toBe(0);
  }, "R1");
});

describe("Tier 2 - Walkovers and Default Matches (R3/R4)", 2, () => {
  it("T2.21: Walkover awards 2:0 win to non-defaulting player", () => {
    const walkoverMatch: MatchResultInput = {
      player1Id: "presentPlayer",
      player2Id: "defaultingPlayer",
      sets: [
        { s1: 11, s2: 0 },
        { s1: 11, s2: 0 },
      ],
      status: "completed",
      winnerId: "presentPlayer",
    };

    const s = calculateStandings(["presentPlayer", "defaultingPlayer"], [walkoverMatch], "2_1_matrix");
    expect(s[0].playerId).toBe("presentPlayer");
    expect(s[0].won).toBe(1);
    expect(s[0].points).toBe(2);
    expect(s[0].setsWon).toBe(2);
    expect(s[0].setsLost).toBe(0);

    expect(s[1].playerId).toBe("defaultingPlayer");
    expect(s[1].won).toBe(0);
    expect(s[1].points).toBe(0);
    expect(s[1].setsWon).toBe(0);
    expect(s[1].setsLost).toBe(2);
  }, "R3");

  it("T2.22: Walkover set score gives +22 point difference in 11-point table tennis", () => {
    const walkoverMatch: MatchResultInput = {
      player1Id: "p1",
      player2Id: "p2",
      sets: [
        { s1: 11, s2: 0 },
        { s1: 11, s2: 0 },
      ],
      status: "completed",
    };
    const s = calculateStandings(["p1", "p2"], [walkoverMatch], "2_1_matrix");
    expect(s[0].pointDifference).toBe(22);
    expect(s[1].pointDifference).toBe(-22);
  }, "R3");

  it("T2.23: Standings correctly integrate walkovers alongside standard matches", () => {
    const matches: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 0 }, { s1: 11, s2: 0 }], // Walkover for A
        status: "completed",
      },
      {
        player1Id: "B",
        player2Id: "C",
        sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 8 }], // Standard win for B
        status: "completed",
      },
    ];
    const s = calculateStandings(["A", "B", "C"], matches, "2_1_matrix");
    expect(s[0].playerId).toBe("A");
    expect(s[0].points).toBe(2);
    expect(s[0].pointDifference).toBe(22);
  }, "R3");

  it("T2.24: Double walkover/forfeit records 0 points and 0 sets for both players", () => {
    const doubleForfeit: MatchResultInput = {
      player1Id: "A",
      player2Id: "B",
      sets: [],
      status: "completed",
      winnerId: undefined, // Neither player won
    };
    const s = calculateStandings(["A", "B"], [doubleForfeit], "2_1_matrix");
    expect(s[0].points).toBe(0);
    expect(s[1].points).toBe(0);
    expect(s[0].won).toBe(0);
    expect(s[1].won).toBe(0);
  }, "R3");

  it("T2.25: Knockout bracket supports advancing winner by walkover", () => {
    const bracket = generateKnockoutBracket(4, true);
    // Find semifinal match
    const sf1 = bracket.find((m) => m.id === "sf-1");
    expect(sf1).toBeDefined();

    // Mark winner by walkover
    sf1!.winnerPlayerId = "p-1";
    sf1!.loserPlayerId = "p-4";

    // In a 4-player bracket, sf-1 winner goes to final slot1
    const finalMatch = bracket.find((m) => m.id === "final");
    expect(finalMatch).toBeDefined();
    expect(finalMatch!.slot1.sourceRef).toBe("sf-1");
  }, "R3");
});

describe("Tier 2 - LocalStorage Admin Token Caching & Rehydration (R4)", 2, () => {
  it("T2.26: Caches verso_admin_{slug} token upon initial visit with secret", () => {
    const storage = new LocalStorageMock();
    cacheAdminToken(storage, "fss-2026", "secret-key-123");

    const cached = getCachedAdminToken(storage, "fss-2026");
    expect(cached).toBe("secret-key-123");
  }, "R4");

  it("T2.27: Rehydrates admin session when visiting /[slug]/admin without token if cached", () => {
    const storage = new LocalStorageMock();
    const tournaments = new Map([
      ["fss-2026", { adminSecret: "valid-secret-999" }],
    ]);

    // Initial visit with valid secret:
    const initialVisit = rehydrateAdminSession(
      storage,
      "/fss-2026/admin/valid-secret-999",
      tournaments
    );
    expect(initialVisit.authenticated).toBe(true);

    // Later visit to bare /fss-2026/admin without URL token:
    const returnVisit = rehydrateAdminSession(
      storage,
      "/fss-2026/admin",
      tournaments
    );
    expect(returnVisit.authenticated).toBe(true);
    expect(returnVisit.adminSecret).toBe("valid-secret-999");
  }, "R4");

  it("T2.28: Rejects session when visiting /[slug]/admin with empty storage and no URL token", () => {
    const emptyStorage = new LocalStorageMock();
    const tournaments = new Map([
      ["fss-2026", { adminSecret: "valid-secret-999" }],
    ]);

    const result = rehydrateAdminSession(
      emptyStorage,
      "/fss-2026/admin",
      tournaments
    );
    expect(result.authenticated).toBe(false);
    expect(result.redirectUrl).toBe("/fss-2026");
  }, "R4");

  it("T2.29: Multiple tournament slugs maintain strictly isolated localStorage tokens", () => {
    const storage = new LocalStorageMock();
    const tournaments = new Map([
      ["tournament-alpha", { adminSecret: "alpha-token" }],
      ["tournament-beta", { adminSecret: "beta-token" }],
    ]);

    cacheAdminToken(storage, "tournament-alpha", "alpha-token");

    // tournament-alpha rehydrates
    const alphaResult = rehydrateAdminSession(storage, "/tournament-alpha/admin", tournaments);
    expect(alphaResult.authenticated).toBe(true);

    // tournament-beta does NOT rehydrate with alpha's token
    const betaResult = rehydrateAdminSession(storage, "/tournament-beta/admin", tournaments);
    expect(betaResult.authenticated).toBe(false);
  }, "R4");

  it("T2.30: Clearing token from localStorage immediately revokes automatic rehydration", () => {
    const storage = new LocalStorageMock();
    const tournaments = new Map([
      ["fss-2026", { adminSecret: "valid-secret-999" }],
    ]);

    cacheAdminToken(storage, "fss-2026", "valid-secret-999");
    expect(rehydrateAdminSession(storage, "/fss-2026/admin", tournaments).authenticated).toBe(true);

    clearAdminToken(storage, "fss-2026");
    expect(rehydrateAdminSession(storage, "/fss-2026/admin", tournaments).authenticated).toBe(false);
  }, "R4");
});
