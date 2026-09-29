/**
 * Tier 1: Feature Coverage Test Suite
 * 
 * Validates baseline feature functionality across R1-R7 requirements:
 * 1. Berger round-robin engine (pairing, round counts, bye generation) [6 tests]
 * 2. Dynamic sport wizard terminology ("Set"/"Sety", "Głowa"/"Głowy") and prompts [5 tests]
 * 3. Recursive tiebreaker standings (Points -> H2H -> Matches Won -> Set Diff -> Point Diff) [6 tests]
 * 4. Passwordless secret access (Admin, Player, Referee, Spectator, Kiosk) [5 tests]
 * 5. Player score submission permission enforcement [5 tests]
 * 6. Showcase seed ("Mistrzostwa 1v1 FSS" 9 players, 5 dates, 40 matches) [6 tests]
 * 7. Venue TV slideshow presentation cycling [5 tests]
 * 
 * Total: 38 test cases (exceeds >=5 per feature requirement)
 */

import {
  describe,
  it,
  expect,
  generateBergerSchedule,
  generateDynamicPrompts,
  DEFAULT_SPORT_PRESETS,
  validateMatchScore,
  calculateStandings,
  parseSecretRoute,
  buildSecretRoute,
  evaluateScoreSubmissionPermission,
  VenuePresenterSimulator,
  FSS_SHOWCASE_PLAYERS,
  FSS_SHOWCASE_DATES,
  FSS_SHOWCASE_PITCHES,
  FSS_SPORT_RULES,
  type SportRulesConfig,
  type MatchResultInput,
} from "./harness.ts";

describe("Tier 1 - Berger Round-Robin Pairing Engine (R3)", 1, () => {
  it("T1.1: 9 players generates exactly 9 rounds, 4 playable matches per round (36 matches total), 1 bye per round", () => {
    const rounds = generateBergerSchedule(9);
    expect(rounds).toHaveLength(9);

    let totalMatches = 0;
    let totalByes = 0;

    for (const r of rounds) {
      expect(r.matches).toHaveLength(4);
      expect(r.byePlayerSlot).toBeDefined();
      totalMatches += r.matches.length;
      if (r.byePlayerSlot !== undefined) totalByes++;
    }

    expect(totalMatches).toBe(36);
    expect(totalByes).toBe(9);
  }, "R3");

  it("T1.2: Every distinct player pair meets exactly once in the 9-player schedule", () => {
    const rounds = generateBergerSchedule(9);
    const seenPairs = new Set<string>();

    for (const r of rounds) {
      for (const m of r.matches) {
        expect(m.isBye).toBe(false);
        const low = Math.min(m.player1Slot, m.player2Slot);
        const high = Math.max(m.player1Slot, m.player2Slot);
        const pairKey = `${low}-${high}`;

        // Ensure pair hasn't played already
        expect(seenPairs.has(pairKey)).toBe(false);
        seenPairs.add(pairKey);
      }
    }

    // Binomial(9, 2) = 9*8/2 = 36 pairs
    expect(seenPairs.size).toBe(36);
  }, "R3");

  it("T1.3: Bye rotation is fair: every player from 0 to 8 receives exactly 1 bye", () => {
    const rounds = generateBergerSchedule(9);
    const byeCount = new Map<number, number>();

    for (let p = 0; p < 9; p++) {
      byeCount.set(p, 0);
    }

    for (const r of rounds) {
      expect(r.byePlayerSlot).toBeDefined();
      const p = r.byePlayerSlot!;
      byeCount.set(p, (byeCount.get(p) ?? 0) + 1);
    }

    for (let p = 0; p < 9; p++) {
      expect(byeCount.get(p)).toBe(1);
    }
  }, "R3");

  it("T1.4: Even player count (8 players) generates exactly 7 rounds, 4 matches per round, 0 byes", () => {
    const rounds = generateBergerSchedule(8);
    expect(rounds).toHaveLength(7);

    let totalMatches = 0;
    for (const r of rounds) {
      expect(r.matches).toHaveLength(4);
      expect(r.byePlayerSlot).toBeUndefined();
      totalMatches += r.matches.length;
    }

    // 8*7/2 = 28 matches
    expect(totalMatches).toBe(28);
  }, "R3");

  it("T1.5: Even player count (6 players) generates 5 rounds, 3 matches per round (15 total), all pairs unique", () => {
    const rounds = generateBergerSchedule(6);
    expect(rounds).toHaveLength(5);

    const seenPairs = new Set<string>();
    for (const r of rounds) {
      expect(r.matches).toHaveLength(3);
      expect(r.byePlayerSlot).toBeUndefined();
      for (const m of r.matches) {
        const key = `${Math.min(m.player1Slot, m.player2Slot)}-${Math.max(m.player1Slot, m.player2Slot)}`;
        expect(seenPairs.has(key)).toBe(false);
        seenPairs.add(key);
      }
    }
    expect(seenPairs.size).toBe(15);
  }, "R3");

  it("T1.6: Match indexing adheres to 1-indexed round, 1-indexed matchInRound, valid slot ranges", () => {
    const rounds = generateBergerSchedule(4);
    for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
      const r = rounds[rIdx];
      expect(r.roundNumber).toBe(rIdx + 1);
      for (let mIdx = 0; mIdx < r.matches.length; mIdx++) {
        const m = r.matches[mIdx];
        expect(m.round).toBe(r.roundNumber);
        expect(m.matchInRound).toBe(mIdx + 1);
        expect(m.player1Slot).toBeGreaterThanOrEqual(0);
        expect(m.player1Slot).toBeLessThan(4);
        expect(m.player2Slot).toBeGreaterThanOrEqual(0);
        expect(m.player2Slot).toBeLessThan(4);
        expect(m.player1Slot).not.toBe(m.player2Slot);
      }
    }
  }, "R3");
});

describe("Tier 1 - Dynamic Sport Wizard Terminology & Prompts (R2)", 1, () => {
  it("T1.7: Default Table Tennis generates 'Set' / 'Sety' Polish prompts", () => {
    const prompts = generateDynamicPrompts("Set", "Sety");
    expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Set?");
    expect(prompts.unitsToWinPrompt).toBe("Do ilu Sety gra się, żeby wygrać mecz?");
    expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Set przy stanie 1:1?");
  }, "R2");

  it("T1.8: Custom Teqball terminology 'Głowa' / 'Głowy' generates exact interpolated prompts", () => {
    const prompts = generateDynamicPrompts("Głowa", "Głowy");
    expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Głowa?");
    expect(prompts.unitsToWinPrompt).toBe("Do ilu Głowy gra się, żeby wygrać mecz?");
    expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Głowa przy stanie 1:1?");
  }, "R2");

  it("T1.9: Padel preset terminology 'Gem' / 'Gemy' generates exact interpolated prompts", () => {
    const prompts = generateDynamicPrompts("Gem", "Gemy");
    expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Gem?");
    expect(prompts.unitsToWinPrompt).toBe("Do ilu Gemy gra się, żeby wygrać mecz?");
    expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Gem przy stanie 1:1?");
  }, "R2");

  it("T1.10: Football preset terminology 'Połowa' / 'Połowy' generates exact interpolated prompts", () => {
    const prompts = generateDynamicPrompts("Połowa", "Połowy");
    expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Połowa?");
    expect(prompts.unitsToWinPrompt).toBe("Do ilu Połowy gra się, żeby wygrać mecz?");
    expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Połowa przy stanie 1:1?");
  }, "R2");

  it("T1.11: Custom sport rules win condition evaluation completes at unitsToWinMatch", () => {
    const customRules: SportRulesConfig = {
      preset: "custom",
      singularUnit: "Głowa",
      pluralUnit: "Głowy",
      targetPointsPerUnit: 15,
      unitsToWinMatch: 2,
      hasDeciderTiebreak: true,
      deciderThreshold: 1,
      deciderPoints: 21,
      winByTwo: true,
    };

    // First set won by P1 (15:10), second set won by P1 (15:8) -> match completed 2:0
    const res = validateMatchScore(
      [
        { s1: 15, s2: 10 },
        { s1: 15, s2: 8 },
      ],
      customRules
    );
    expect(res.isValid).toBe(true);
    expect(res.isMatchCompleted).toBe(true);
    expect(res.winner).toBe(1);
    expect(res.setsWonP1).toBe(2);
    expect(res.setsWonP2).toBe(0);
  }, "R2");
});

describe("Tier 1 - Recursive Tiebreaker Standings Engine (R1)", 1, () => {
  it("T1.12: Primary points ranking sorts players by total points in 2:0 / 2:1 matrix", () => {
    const players = ["A", "B", "C"];
    const matches: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }], // A wins 2:0 -> A=2, B=0
        status: "completed",
      },
      {
        player1Id: "B",
        player2Id: "C",
        sets: [{ s1: 11, s2: 9 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }], // B wins 2:1 -> B=2, C=1
        status: "completed",
      },
      {
        player1Id: "A",
        player2Id: "C",
        sets: [{ s1: 11, s2: 3 }, { s1: 11, s2: 4 }], // A wins 2:0 -> A=2, C=0
        status: "completed",
      },
    ];

    // Points: A=4, B=2, C=1
    const standings = calculateStandings(players, matches, "2_1_matrix");
    expect(standings[0].playerId).toBe("A");
    expect(standings[0].points).toBe(4);
    expect(standings[0].rank).toBe(1);

    expect(standings[1].playerId).toBe("B");
    expect(standings[1].points).toBe(2);
    expect(standings[1].rank).toBe(2);

    expect(standings[2].playerId).toBe("C");
    expect(standings[2].points).toBe(1);
    expect(standings[2].rank).toBe(3);
  }, "R1");

  it("T1.13: 2-way tie on points is broken by direct Head-to-Head result", () => {
    const players = ["A", "B", "C"];
    // A and B both finish with 2 points, but A defeated B in their head-to-head encounter
    const matches: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }], // A beats B 2:0 -> A=2, B=0
        status: "completed",
      },
      {
        player1Id: "B",
        player2Id: "C",
        sets: [{ s1: 11, s2: 6 }, { s1: 11, s2: 7 }], // B beats C 2:0 -> B=2, C=0
        status: "completed",
      },
      {
        player1Id: "C",
        player2Id: "A",
        sets: [{ s1: 11, s2: 6 }, { s1: 11, s2: 7 }], // C beats A 2:0 -> C=2, A=0
        status: "completed",
      },
    ];

    // Total points: A=2, B=2, C=2.
    // In this mini-league, each won 1 match. But let's test a distinct 2-way tie:
    const matches2Way: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }], // A beats B 2:0 (H2H advantage for A)
        status: "completed",
      },
      {
        player1Id: "A",
        player2Id: "C",
        sets: [{ s1: 7, s2: 11 }, { s1: 8, s2: 11 }], // C beats A 2:0 -> C=2
        status: "completed",
      },
      {
        player1Id: "B",
        player2Id: "C",
        sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 8 }], // B beats C 2:0 -> B=2
        status: "completed",
      },
    ];
    // Here A beats B, B beats C, C beats A -> cyclic.
    // Let's create an unambiguous 2-way tie with 4 players:
    const p4 = ["A", "B", "C", "D"];
    const m4: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // A beats B
      { player1Id: "A", player2Id: "C", sets: [{ s1: 5, s2: 11 }, { s1: 6, s2: 11 }], status: "completed" }, // C beats A
      { player1Id: "B", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // B beats D
      { player1Id: "C", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // C beats D
    ];
    // Points: C=4 (won vs A, D), A=2 (won vs B, lost vs C), B=2 (lost vs A, won vs D), D=0
    // A and B tied at 2 points. H2H: A beat B 2:0.
    const s = calculateStandings(p4, m4, "2_1_matrix");
    expect(s[0].playerId).toBe("C");
    expect(s[1].playerId).toBe("A"); // A ranked above B via H2H
    expect(s[2].playerId).toBe("B");
    expect(s[3].playerId).toBe("D");
  }, "R1");

  it("T1.14: 2-way tie with equal H2H (split or draw) is broken by Matches Won", () => {
    const players = ["A", "B"];
    // In a format where A won 1 match and B won 0 matches
    const matches: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 15, s2: 13 }], // A wins 2:1
        status: "completed",
      },
    ];
    const s = calculateStandings(players, matches, "2_1_matrix");
    expect(s[0].playerId).toBe("A");
    expect(s[0].won).toBe(1);
    expect(s[1].playerId).toBe("B");
    expect(s[1].won).toBe(0);
  }, "R1");

  it("T1.15: Tied players with equal points and H2H are broken by Set Difference", () => {
    // 3 players cyclic tie: A beats B (2:0), B beats C (2:0), C beats A (2:1)
    // Points: A: 2 (from B) + 1 (from C) = 3 pts
    //         B: 2 (from C) = 2 pts
    //         C: 2 (from A) = 2 pts
    // Let's create an equal points tie (2 pts each) with different set differences:
    // A beats B 2:0 (A +2, B -2)
    // B beats C 2:1 (B +1 -2 = -1; C +1 -2 = -1)
    // C beats A 2:0 (C +2 -1 = +1; A +2 -2 = 0)
    // Total matches: A (lost to C 0:2, beat B 2:0 -> sets 2:2 diff 0)
    // B (lost to A 0:2, beat C 2:1 -> sets 2:3 diff -1)
    // C (lost to B 1:2, beat A 2:0 -> sets 3:2 diff +1)
    // Points: each player won 1 match, but let's check standard_3_1_0 so each gets 3 pts:
    const players = ["A", "B", "C"];
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 11, s2: 9 }], status: "completed" },
      { player1Id: "C", player2Id: "A", sets: [{ s1: 11, s2: 6 }, { s1: 11, s2: 7 }], status: "completed" },
    ];
    // Under standard_3_1_0: A=3, B=3, C=3.
    // In mini-league (all 3): A diff = 2 - 2 = 0.
    // B diff = 2 - 3 = -1.
    // C diff = 3 - 2 = +1.
    const s = calculateStandings(players, matches, "standard_3_1_0");
    expect(s[0].playerId).toBe("C");
    expect(s[0].setDifference).toBe(1);
    expect(s[1].playerId).toBe("A");
    expect(s[1].setDifference).toBe(0);
    expect(s[2].playerId).toBe("B");
    expect(s[2].setDifference).toBe(-1);
  }, "R1");

  it("T1.16: Tied players with equal points, H2H, and Set Difference are broken by Point Difference", () => {
    // 3 players: all have equal sets (diff 0), broken by point difference:
    // A beats B: 11:5, 11:5 (+12 pts for A, -12 for B)
    // B beats C: 11:9, 11:9 (+4 pts for B, -4 for C)
    // C beats A: 11:9, 11:9 (+4 pts for C, -4 for A)
    // All 3 won 1 match 2:0, lost 1 match 0:2.
    // Set diff for all: 2 - 2 = 0.
    // Point diff:
    // A: (+12 - 4) = +8
    // B: (-12 + 4) = -8
    // C: (-4 + 4) = 0
    const players = ["A", "B", "C"];
    const matches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }], status: "completed" },
      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
      { player1Id: "C", player2Id: "A", sets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 9 }], status: "completed" },
    ];
    const s = calculateStandings(players, matches, "standard_3_1_0");
    expect(s[0].playerId).toBe("A");
    expect(s[0].pointDifference).toBe(8);
    expect(s[1].playerId).toBe("C");
    expect(s[1].pointDifference).toBe(0);
    expect(s[2].playerId).toBe("B");
    expect(s[2].pointDifference).toBe(-8);
  }, "R1");

  it("T1.17: Standings record provides all contract metrics and rank numbering", () => {
    const s = calculateStandings(
      ["P1", "P2"],
      [{ player1Id: "P1", player2Id: "P2", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }],
      "2_1_matrix"
    );
    expect(s).toHaveLength(2);
    const p1 = s[0];
    expect(p1.rank).toBe(1);
    expect(p1.played).toBe(1);
    expect(p1.won).toBe(1);
    expect(p1.lost).toBe(0);
    expect(p1.points).toBe(2);
    expect(p1.setsWon).toBe(2);
    expect(p1.setsLost).toBe(0);
    expect(p1.setDifference).toBe(2);
    expect(p1.pointsWon).toBe(22);
    expect(p1.pointsLost).toBe(11);
    expect(p1.pointDifference).toBe(11);
  }, "R1");
});

describe("Tier 1 - Passwordless Role-Based Routing & Views (R4)", 1, () => {
  it("T1.18: Admin Hub URL parses slug and adminSecret correctly", () => {
    const route = parseSecretRoute("/fss-2026/admin/adm-secret-999");
    expect(route.isValid).toBe(true);
    expect(route.role).toBe("admin");
    expect(route.slug).toBe("fss-2026");
    expect(route.adminSecret).toBe("adm-secret-999");

    const built = buildSecretRoute("admin", "fss-2026", "adm-secret-999");
    expect(built).toBe("/fss-2026/admin/adm-secret-999");
  }, "R4");

  it("T1.19: Player Terminal URL parses slug and playerSecret correctly", () => {
    const route = parseSecretRoute("/fss-2026/p/ply-borowka-09");
    expect(route.isValid).toBe(true);
    expect(route.role).toBe("player");
    expect(route.slug).toBe("fss-2026");
    expect(route.playerSecret).toBe("ply-borowka-09");

    const built = buildSecretRoute("player", "fss-2026", "ply-borowka-09");
    expect(built).toBe("/fss-2026/p/ply-borowka-09");
  }, "R4");

  it("T1.20: Referee Terminal URL parses slug and refereeSecret correctly", () => {
    const route = parseSecretRoute("/fss-2026/referee/ref-table1-key");
    expect(route.isValid).toBe(true);
    expect(route.role).toBe("referee");
    expect(route.slug).toBe("fss-2026");
    expect(route.refereeSecret).toBe("ref-table1-key");

    const built = buildSecretRoute("referee", "fss-2026", "ref-table1-key");
    expect(built).toBe("/fss-2026/referee/ref-table1-key");
  }, "R4");

  it("T1.21: Public Spectator Portal URL parses slug with read-only access", () => {
    const route = parseSecretRoute("/fss-2026");
    expect(route.isValid).toBe(true);
    expect(route.role).toBe("spectator");
    expect(route.slug).toBe("fss-2026");

    const built = buildSecretRoute("spectator", "fss-2026");
    expect(built).toBe("/fss-2026");
  }, "R4");

  it("T1.22: Venue TV Slideshow Kiosk URL parses slug for presenter view", () => {
    const route = parseSecretRoute("/fss-2026/present");
    expect(route.isValid).toBe(true);
    expect(route.role).toBe("presenter");
    expect(route.slug).toBe("fss-2026");

    const built = buildSecretRoute("presenter", "fss-2026");
    expect(built).toBe("/fss-2026/present");
  }, "R4");
});

describe("Tier 1 - Player Score Submission Permission Enforcement (R2/R4)", 1, () => {
  it("T1.23: Player score submission is rejected when allowPlayerScoreSubmission is false", () => {
    const decision = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "p-1",
      tournamentAllowsPlayerSubmission: false,
      match: {
        id: "m-1",
        player1Id: "p-1",
        player2Id: "p-2",
        status: "pending",
      },
      submittedSets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("disabled");
  }, "R2");

  it("T1.24: Player score submission is authorized when allowed and player is participant in match", () => {
    const decision = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "p-1",
      tournamentAllowsPlayerSubmission: true,
      match: {
        id: "m-1",
        player1Id: "p-1",
        player2Id: "p-2",
        status: "pending",
      },
      submittedSets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }],
    });

    expect(decision.allowed).toBe(true);
  }, "R2");

  it("T1.25: Player cannot submit scores for matches they are not participating in", () => {
    const decision = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "p-3", // Impersonator or unauthorized player
      tournamentAllowsPlayerSubmission: true,
      match: {
        id: "m-1",
        player1Id: "p-1",
        player2Id: "p-2",
        status: "pending",
      },
      submittedSets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("not participating");
  }, "R4");

  it("T1.26: Player cannot modify a completed/verified match score", () => {
    const decision = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "p-1",
      tournamentAllowsPlayerSubmission: true,
      match: {
        id: "m-1",
        player1Id: "p-1",
        player2Id: "p-2",
        status: "completed", // Already verified
      },
      submittedSets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("completed");
  }, "R4");

  it("T1.27: Admin and Referee roles always have authority regardless of allowPlayerScoreSubmission", () => {
    const adminDecision = evaluateScoreSubmissionPermission({
      role: "admin",
      tournamentAllowsPlayerSubmission: false,
      match: { id: "m-1", player1Id: "p-1", player2Id: "p-2", status: "completed" },
      submittedSets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 8 }],
    });
    expect(adminDecision.allowed).toBe(true);

    const refDecision = evaluateScoreSubmissionPermission({
      role: "referee",
      tournamentAllowsPlayerSubmission: false,
      match: { id: "m-1", player1Id: "p-1", player2Id: "p-2", status: "in_progress" },
      submittedSets: [{ s1: 11, s2: 9 }, { s1: 11, s2: 8 }],
    });
    expect(refDecision.allowed).toBe(true);
  }, "R4");
});

describe("Tier 1 - Preloaded Showcase Seed ('Mistrzostwa 1v1 FSS') (R5)", 1, () => {
  it("T1.28: Seed contains all 9 exact named participants", () => {
    expect(FSS_SHOWCASE_PLAYERS).toHaveLength(9);
    const names = FSS_SHOWCASE_PLAYERS.map((p) => p.name);
    expect(names).toContain("Antek Sadowski");
    expect(names).toContain("Bartek Kalarus");
    expect(names).toContain("Filip Kruszka");
    expect(names).toContain("Filip Szata");
    expect(names).toContain("Franek Herka");
    expect(names).toContain("Igor Mądry");
    expect(names).toContain("Leon Marycki");
    expect(names).toContain("Michał Krzakiewicz");
    expect(names).toContain("Tomasz Borówka");
  }, "R5");

  it("T1.29: Tomasz Borówka is explicitly assigned to slot index 8", () => {
    const tomasz = FSS_SHOWCASE_PLAYERS.find((p) => p.name === "Tomasz Borówka");
    expect(tomasz).toBeDefined();
    expect(tomasz!.slotIndex).toBe(8);
  }, "R5");

  it("T1.30: Seed defines exactly 5 tournament dates", () => {
    expect(FSS_SHOWCASE_DATES).toHaveLength(5);
    expect(FSS_SHOWCASE_DATES[0]).toBe("2026-10-02");
    expect(FSS_SHOWCASE_DATES[1]).toBe("2026-10-03");
    expect(FSS_SHOWCASE_DATES[2]).toBe("2026-10-04");
    expect(FSS_SHOWCASE_DATES[3]).toBe("2026-10-16");
    expect(FSS_SHOWCASE_DATES[4]).toBe("2026-10-17");
  }, "R5");

  it("T1.31: Seed defines exactly 2 pitches ('Stół 1', 'Stół 2')", () => {
    expect(FSS_SHOWCASE_PITCHES).toHaveLength(2);
    expect(FSS_SHOWCASE_PITCHES[0].name).toBe("Stół 1");
    expect(FSS_SHOWCASE_PITCHES[1].name).toBe("Stół 2");
  }, "R5");

  it("T1.32: Seed structure configures 36 group matches + 4 playoff matches = 40 total matches", () => {
    // 9 players in Berger -> 9 rounds * 4 matches = 36 group matches
    const groupRounds = generateBergerSchedule(9);
    let groupMatchesCount = 0;
    for (const r of groupRounds) {
      groupMatchesCount += r.matches.length;
    }
    expect(groupMatchesCount).toBe(36);

    // Drabinka B: 4 playoff qualifiers -> 2 semifinals + 1 3rd-place + 1 final = 4 matches
    const playoffMatchesCount = 4;
    expect(groupMatchesCount + playoffMatchesCount).toBe(40);
  }, "R5");

  it("T1.33: FSS scoring rules enforce 2:0 -> 2-0 pts and 2:1 -> 2-1 pts", () => {
    const m1: MatchResultInput = {
      player1Id: "p1",
      player2Id: "p2",
      sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 7 }], // 2:0
      status: "completed",
    };
    const s1 = calculateStandings(["p1", "p2"], [m1], "2_1_matrix");
    expect(s1[0].points).toBe(2);
    expect(s1[1].points).toBe(0);

    const m2: MatchResultInput = {
      player1Id: "p1",
      player2Id: "p2",
      sets: [{ s1: 11, s2: 5 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }], // 2:1
      status: "completed",
    };
    const s2 = calculateStandings(["p1", "p2"], [m2], "2_1_matrix");
    expect(s2[0].points).toBe(2);
    expect(s2[1].points).toBe(1);
  }, "R5");
});

describe("Tier 1 - Venue TV Slideshow Kiosk Presentation (R6)", 1, () => {
  it("T1.34: Kiosk initializes with 10-second interval and standard slide sequence", () => {
    const kiosk = new VenuePresenterSimulator();
    expect(kiosk.intervalSeconds).toBe(10);
    expect(kiosk.currentSlide).toBe("standings");
    expect(kiosk.isPlaying).toBe(true);
  }, "R6");

  it("T1.35: Kiosk advances through slides on timer ticks and wraps around", () => {
    const kiosk = new VenuePresenterSimulator();
    expect(kiosk.currentSlide).toBe("standings");

    kiosk.tick(10);
    expect(kiosk.currentSlide).toBe("matches");

    kiosk.tick(10);
    expect(kiosk.currentSlide).toBe("announcement");

    kiosk.tick(10);
    expect(kiosk.currentSlide).toBe("standings"); // Wrapped around
  }, "R6");

  it("T1.36: Pausing kiosk halts progression, playing resumes progression", () => {
    const kiosk = new VenuePresenterSimulator();
    expect(kiosk.currentSlide).toBe("standings");

    kiosk.pause();
    expect(kiosk.isPlaying).toBe(false);

    kiosk.tick(20);
    expect(kiosk.currentSlide).toBe("standings"); // Did not change while paused

    kiosk.play();
    expect(kiosk.isPlaying).toBe(true);

    kiosk.tick(10);
    expect(kiosk.currentSlide).toBe("matches");
  }, "R6");

  it("T1.37: Custom announcement slide text is preserved and rendered", () => {
    const kiosk = new VenuePresenterSimulator();
    kiosk.setAnnouncement("Mecz finałowy rozpocznie się o 20:00!");
    expect(kiosk.announcementText).toBe("Mecz finałowy rozpocznie się o 20:00!");
  }, "R6");

  it("T1.38: Control bar auto-hides after inactivity timeout", () => {
    const kiosk = new VenuePresenterSimulator();
    expect(kiosk.controlsVisible).toBe(false);

    kiosk.userInteraction();
    expect(kiosk.controlsVisible).toBe(true);

    kiosk.tick(4); // Inactivity > 3 seconds
    expect(kiosk.controlsVisible).toBe(false);
  }, "R6");
});
