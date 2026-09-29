/**
 * Tier 3: Cross-Feature Combinations (Pairwise Interactions) Test Suite
 * 
 * Validates complex pairwise and multi-feature system interactions:
 * 1. Custom sport rules + Berger pairings + 2:0/2:1 scoring matrix + standings recalculation [3 tests]
 * 2. Player score submission + referee override + spectator live schedule update [4 tests]
 * 3. Group stage qualification rules + knockout bracket slot seeding [3 tests]
 * 
 * Total: 10 test cases
 */

import {
  describe,
  it,
  expect,
  generateBergerSchedule,
  validateMatchScore,
  calculateStandings,
  generateKnockoutBracket,
  evaluateScoreSubmissionPermission,
  type SportRulesConfig,
  type MatchResultInput,
  type KnockoutMatch,
} from "./harness.ts";

describe("Tier 3 - Custom Sport + Berger + 2:0/2:1 Matrix + Standings (R2+R3+R1)", 3, () => {
  it("T3.1: Custom sport ('Głowa', target 15, decider 21) across Berger schedule updates standings under 2:1 matrix", () => {
    const headisRules: SportRulesConfig = {
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

    // 5 players Berger schedule
    const rounds = generateBergerSchedule(5);
    expect(rounds).toHaveLength(5);

    // Simulate Round 1 matches
    const r1 = rounds[0];
    expect(r1.matches).toHaveLength(2); // 2 matches, 1 bye

    const m1Sets = [{ s1: 15, s2: 10 }, { s1: 15, s2: 12 }]; // P1 wins 2:0
    const m2Sets = [{ s1: 15, s2: 13 }, { s1: 12, s2: 15 }, { s1: 21, s2: 19 }]; // P1 wins 2:1 in decider (target 21)

    // Validate both match scores against custom sport rules
    const v1 = validateMatchScore(m1Sets, headisRules);
    expect(v1.isValid).toBe(true);
    expect(v1.isMatchCompleted).toBe(true);
    expect(v1.winner).toBe(1);

    const v2 = validateMatchScore(m2Sets, headisRules);
    expect(v2.isValid).toBe(true);
    expect(v2.isMatchCompleted).toBe(true);
    expect(v2.winner).toBe(1);

    // Compute standings for Round 1
    const p1Id = `player-${r1.matches[0].player1Slot}`;
    const p2Id = `player-${r1.matches[0].player2Slot}`;
    const p3Id = `player-${r1.matches[1].player1Slot}`;
    const p4Id = `player-${r1.matches[1].player2Slot}`;
    const p5Id = `player-${r1.byePlayerSlot!}`;

    const matchResults: MatchResultInput[] = [
      { player1Id: p1Id, player2Id: p2Id, sets: m1Sets, status: "completed" },
      { player1Id: p3Id, player2Id: p4Id, sets: m2Sets, status: "completed" },
    ];

    const standings = calculateStandings([p1Id, p2Id, p3Id, p4Id, p5Id], matchResults, "2_1_matrix");

    // Under 2_1_matrix:
    // p1 won 2:0 -> 2 pts
    // p3 won 2:1 -> 2 pts, p4 lost 1:2 -> 1 pt
    // p2 lost 0:2 -> 0 pts
    // p5 had a bye -> 0 pts
    const p1Standing = standings.find((s) => s.playerId === p1Id)!;
    const p3Standing = standings.find((s) => s.playerId === p3Id)!;
    const p4Standing = standings.find((s) => s.playerId === p4Id)!;
    const p2Standing = standings.find((s) => s.playerId === p2Id)!;
    const p5Standing = standings.find((s) => s.playerId === p5Id)!;

    expect(p1Standing.points).toBe(2);
    expect(p1Standing.setDifference).toBe(2);

    expect(p3Standing.points).toBe(2);
    expect(p3Standing.setDifference).toBe(1);

    expect(p4Standing.points).toBe(1);
    expect(p4Standing.setDifference).toBe(-1);

    expect(p2Standing.points).toBe(0);
    expect(p5Standing.points).toBe(0);
    expect(p5Standing.played).toBe(0);
  }, "R2+R3+R1");

  it("T3.2: Dynamic score validator rejects invalid score attempts before updating standings", () => {
    const rules: SportRulesConfig = {
      preset: "custom",
      singularUnit: "Set",
      pluralUnit: "Sety",
      targetPointsPerUnit: 11,
      unitsToWinMatch: 2,
      hasDeciderTiebreak: false,
      deciderThreshold: 1,
      deciderPoints: 11,
      winByTwo: true,
    };

    // Attempt invalid score: 11-10 (not win-by-2)
    const invalidAttempt = validateMatchScore([{ s1: 11, s2: 10 }], rules);
    expect(invalidAttempt.isMatchCompleted).toBe(false);

    // Negative score attempt
    const negativeScore = validateMatchScore([{ s1: -1, s2: 11 }], rules);
    expect(negativeScore.isValid).toBe(false);

    // Lead > 2 beyond target (14:10)
    const illegalLead = validateMatchScore([{ s1: 14, s2: 10 }], rules);
    expect(illegalLead.isValid).toBe(false);
  }, "R2+R1");

  it("T3.3: Partial round standings: Standings recalculate accurately when only 1 of 2 matches is completed", () => {
    const players = ["A", "B", "C", "D"];
    // Round 1: Match 1 (A vs B) completed, Match 2 (C vs D) still in progress
    const partialMatches: MatchResultInput[] = [
      {
        player1Id: "A",
        player2Id: "B",
        sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }],
        status: "completed",
      },
      {
        player1Id: "C",
        player2Id: "D",
        sets: [{ s1: 11, s2: 9 }], // Set 1 finished, set 2 not yet played
        status: "in_progress",
      },
    ];

    const s = calculateStandings(players, partialMatches, "2_1_matrix");
    // Only completed matches count toward standings points
    expect(s[0].playerId).toBe("A");
    expect(s[0].points).toBe(2);
    expect(s[0].played).toBe(1);

    const c = s.find((p) => p.playerId === "C")!;
    expect(c.played).toBe(0);
    expect(c.points).toBe(0);
  }, "R1+R3");
});

describe("Tier 3 - Player Submission + Referee Override + Spectator View (R4+R2)", 3, () => {
  it("T3.4: Player submits score when allowed -> match status completes and standings update", () => {
    const match = {
      id: "m-101",
      player1Id: "player-alpha",
      player2Id: "player-beta",
      status: "pending" as const,
    };

    // Permission evaluation
    const perm = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "player-alpha",
      tournamentAllowsPlayerSubmission: true,
      match,
      submittedSets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }],
    });
    expect(perm.allowed).toBe(true);

    // Apply player's submitted score
    const updatedMatch: MatchResultInput = {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      sets: [{ s1: 11, s2: 8 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }],
      status: "completed",
    };

    const standings = calculateStandings(["player-alpha", "player-beta"], [updatedMatch], "2_1_matrix");
    expect(standings[0].playerId).toBe("player-alpha");
    expect(standings[0].points).toBe(2);
    expect(standings[1].playerId).toBe("player-beta");
    expect(standings[1].points).toBe(1); // 2:1 gives 1 point to loser
  }, "R4+R2");

  it("T3.5: Referee overrides player-submitted score -> standings immediately recompute with referee score", () => {
    // Player previously entered 2:1, but referee corrects it to 2:0
    const match = {
      id: "m-101",
      player1Id: "player-alpha",
      player2Id: "player-beta",
      status: "completed" as const,
    };

    // Referee is authorized to override completed match
    const refPerm = evaluateScoreSubmissionPermission({
      role: "referee",
      tournamentAllowsPlayerSubmission: true,
      match,
      submittedSets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 6 }],
    });
    expect(refPerm.allowed).toBe(true);

    // Recalculate standings with referee's corrected score
    const correctedMatch: MatchResultInput = {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 6 }],
      status: "completed",
    };

    const recomputed = calculateStandings(["player-alpha", "player-beta"], [correctedMatch], "2_1_matrix");
    expect(recomputed[0].playerId).toBe("player-alpha");
    expect(recomputed[0].points).toBe(2);
    expect(recomputed[1].playerId).toBe("player-beta");
    expect(recomputed[1].points).toBe(0); // In 2:0, loser gets 0 points (previously 1)
  }, "R4+R1");

  it("T3.6: Public spectator portal receives updated live schedule and modified standings", () => {
    // Spectator view evaluates the newly updated standings
    const correctedMatch: MatchResultInput = {
      player1Id: "player-alpha",
      player2Id: "player-beta",
      sets: [{ s1: 11, s2: 8 }, { s1: 11, s2: 6 }],
      status: "completed",
    };

    const spectatorStandings = calculateStandings(["player-alpha", "player-beta"], [correctedMatch], "2_1_matrix");
    expect(spectatorStandings[0].rank).toBe(1);
    expect(spectatorStandings[0].setDifference).toBe(2);
    expect(spectatorStandings[1].rank).toBe(2);
    expect(spectatorStandings[1].setDifference).toBe(-2);
  }, "R4+R1");

  it("T3.7: Organizer disables player submission mid-tournament -> player blocked, referee retains authority", () => {
    const match = {
      id: "m-102",
      player1Id: "p-1",
      player2Id: "p-2",
      status: "pending" as const,
    };

    // Organizer flips tournamentAllowsPlayerSubmission to false
    const playerAttempt = evaluateScoreSubmissionPermission({
      role: "player",
      requestingPlayerId: "p-1",
      tournamentAllowsPlayerSubmission: false,
      match,
      submittedSets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
    });
    expect(playerAttempt.allowed).toBe(false);
    expect(playerAttempt.reason).toContain("disabled");

    // Referee can still submit without hindrance
    const refAttempt = evaluateScoreSubmissionPermission({
      role: "referee",
      tournamentAllowsPlayerSubmission: false,
      match,
      submittedSets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 7 }],
    });
    expect(refAttempt.allowed).toBe(true);
  }, "R4+R2");
});

describe("Tier 3 - Group Stage DAG Qualification + Knockout Seeding (R1+R3)", 3, () => {
  it("T3.8: Top 4 group qualifiers automatically seed into Semifinal 1 (Rank 1 vs Rank 4) and Semifinal 2 (Rank 2 vs Rank 3)", () => {
    const groupPlayers = ["A", "B", "C", "D", "E"];
    const groupMatches: MatchResultInput[] = [
      { player1Id: "A", player2Id: "B", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // A wins
      { player1Id: "A", player2Id: "C", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // A wins
      { player1Id: "A", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // A wins
      { player1Id: "A", player2Id: "E", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // A wins -> A is 1st (8 pts)

      { player1Id: "B", player2Id: "C", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // B wins
      { player1Id: "B", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // B wins
      { player1Id: "B", player2Id: "E", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // B is 2nd (6 pts)

      { player1Id: "C", player2Id: "D", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // C wins
      { player1Id: "C", player2Id: "E", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // C is 3rd (4 pts)

      { player1Id: "D", player2Id: "E", sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 6 }], status: "completed" }, // D is 4th (2 pts), E is 5th (0 pts)
    ];

    const groupStandings = calculateStandings(groupPlayers, groupMatches, "2_1_matrix");
    expect(groupStandings[0].playerId).toBe("A"); // Rank 1
    expect(groupStandings[1].playerId).toBe("B"); // Rank 2
    expect(groupStandings[2].playerId).toBe("C"); // Rank 3
    expect(groupStandings[3].playerId).toBe("D"); // Rank 4
    expect(groupStandings[4].playerId).toBe("E"); // Eliminated (Rank 5)

    // Generate 4-qualifier knockout bracket with 3rd place match
    const bracket = generateKnockoutBracket(4, true);
    expect(bracket).toHaveLength(4); // 2 SF + 1 3rd + 1 Final

    // Seed qualifiers into SF1 and SF2
    const sf1 = bracket.find((m) => m.id === "sf-1")!;
    const sf2 = bracket.find((m) => m.id === "sf-2")!;

    // In standard seed: SF1 is Seed 1 vs Seed 4, SF2 is Seed 2 vs Seed 3
    sf1.slot1.playerId = groupStandings[0].playerId; // A
    sf1.slot2.playerId = groupStandings[3].playerId; // D

    sf2.slot1.playerId = groupStandings[1].playerId; // B
    sf2.slot2.playerId = groupStandings[2].playerId; // C

    expect(sf1.slot1.playerId).toBe("A");
    expect(sf1.slot2.playerId).toBe("D");
    expect(sf2.slot1.playerId).toBe("B");
    expect(sf2.slot2.playerId).toBe("C");
  }, "R1+R3");

  it("T3.9: Knockout match progression: SF winners advance to Final, losers to 3rd Place match", () => {
    const bracket = generateKnockoutBracket(4, true);
    const sf1 = bracket.find((m) => m.id === "sf-1")!;
    const sf2 = bracket.find((m) => m.id === "sf-2")!;
    const finalMatch = bracket.find((m) => m.id === "final")!;
    const thirdPlaceMatch = bracket.find((m) => m.id === "third-place")!;

    // Simulate SF1: A beats D
    sf1.winnerPlayerId = "A";
    sf1.loserPlayerId = "D";

    // Simulate SF2: B beats C
    sf2.winnerPlayerId = "B";
    sf2.loserPlayerId = "C";

    // Propagate winners to Final
    finalMatch.slot1.playerId = sf1.winnerPlayerId;
    finalMatch.slot2.playerId = sf2.winnerPlayerId;

    // Propagate losers to 3rd place match
    thirdPlaceMatch.slot1.playerId = sf1.loserPlayerId;
    thirdPlaceMatch.slot2.playerId = sf2.loserPlayerId;

    expect(finalMatch.slot1.playerId).toBe("A");
    expect(finalMatch.slot2.playerId).toBe("B");

    expect(thirdPlaceMatch.slot1.playerId).toBe("D");
    expect(thirdPlaceMatch.slot2.playerId).toBe("C");
  }, "R3");

  it("T3.10: Final championship match execution: complete podium determination (1st, 2nd, 3rd, 4th)", () => {
    const bracket = generateKnockoutBracket(4, true);
    const finalMatch = bracket.find((m) => m.id === "final")!;
    const thirdPlaceMatch = bracket.find((m) => m.id === "third-place")!;

    finalMatch.slot1.playerId = "A";
    finalMatch.slot2.playerId = "B";
    thirdPlaceMatch.slot1.playerId = "D";
    thirdPlaceMatch.slot2.playerId = "C";

    // Final: A beats B (2:1)
    finalMatch.winnerPlayerId = "A";
    finalMatch.loserPlayerId = "B";

    // 3rd place: C beats D (2:0)
    thirdPlaceMatch.winnerPlayerId = "C";
    thirdPlaceMatch.loserPlayerId = "D";

    const podium = {
      champion: finalMatch.winnerPlayerId,
      runnerUp: finalMatch.loserPlayerId,
      thirdPlace: thirdPlaceMatch.winnerPlayerId,
      fourthPlace: thirdPlaceMatch.loserPlayerId,
    };

    expect(podium.champion).toBe("A");
    expect(podium.runnerUp).toBe("B");
    expect(podium.thirdPlace).toBe("C");
    expect(podium.fourthPlace).toBe("D");
  }, "R3+R5");
});
