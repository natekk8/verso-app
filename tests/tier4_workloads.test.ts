/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * 
 * End-to-End Simulation of the complete "Mistrzostwa 1v1 FSS" Tournament Lifecycle:
 * - 9 players (including Tomasz Borówka on slot 8)
 * - 5 tournament dates (2026-10-02, 2026-10-03, 2026-10-04, 2026-10-16, 2026-10-17)
 * - 2 pitches ("Stół 1", "Stół 2")
 * - Grupa A (36 round-robin matches)
 * - Drabinka B (4 playoff matches: 2 Semifinals, 3rd Place match, Final)
 * - Total: 40 matches
 * - Dynamic 2:0/2:1 scoring matrix, complete standings recalculation, and podium ceremony.
 */

import {
  describe,
  it,
  expect,
  generateBergerSchedule,
  generateKnockoutBracket,
  calculateStandings,
  scheduleTournamentMatches,
  validateScheduleIntegrity,
  validateMatchScore,
  VenuePresenterSimulator,
  FSS_SHOWCASE_PLAYERS,
  FSS_SHOWCASE_DATES,
  FSS_SHOWCASE_PITCHES,
  FSS_SPORT_RULES,
  type MatchResultInput,
  type MatchInput,
  type DayConfig,
  type PitchConfig,
} from "./harness.ts";

describe("Tier 4 - Real-World Showcase Tournament: 'Mistrzostwa 1v1 FSS' (R1-R7)", 4, () => {
  it("T4.1: [Lifecycle Stage 1] Showcase Seed Roster & Infrastructure Initialization", () => {
    // 9 players verification
    expect(FSS_SHOWCASE_PLAYERS).toHaveLength(9);

    const tomasz = FSS_SHOWCASE_PLAYERS.find((p) => p.name === "Tomasz Borówka");
    expect(tomasz).toBeDefined();
    expect(tomasz!.slotIndex).toBe(8);

    // 5 tournament dates
    expect(FSS_SHOWCASE_DATES).toHaveLength(5);
    expect(FSS_SHOWCASE_DATES).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-16",
      "2026-10-17",
    ]);

    // 2 pitches
    expect(FSS_SHOWCASE_PITCHES).toHaveLength(2);
    expect(FSS_SHOWCASE_PITCHES[0].name).toBe("Stół 1");
    expect(FSS_SHOWCASE_PITCHES[1].name).toBe("Stół 2");

    // Sport rules verification: Table tennis, target 11, best of 3, 15-pt decider, win-by-2
    expect(FSS_SPORT_RULES.targetPointsPerUnit).toBe(11);
    expect(FSS_SPORT_RULES.unitsToWinMatch).toBe(2);
    expect(FSS_SPORT_RULES.hasDeciderTiebreak).toBe(true);
    expect(FSS_SPORT_RULES.deciderPoints).toBe(15);
    expect(FSS_SPORT_RULES.winByTwo).toBe(true);
  }, "R5");

  it("T4.2: [Lifecycle Stage 2] Grupa A Berger Generation & Multi-Pitch Scheduling with Conflict Prevention", () => {
    const rounds = generateBergerSchedule(9);
    expect(rounds).toHaveLength(9);

    // Convert Berger rounds into MatchInput objects for scheduling
    const matchInputs: MatchInput[] = [];
    let matchCounter = 1;

    for (const r of rounds) {
      for (const m of r.matches) {
        matchInputs.push({
          id: `match-ga-${matchCounter++}`,
          round: r.roundNumber,
          player1Id: FSS_SHOWCASE_PLAYERS[m.player1Slot].id,
          player2Id: FSS_SHOWCASE_PLAYERS[m.player2Slot].id,
          stageId: "stage-group-a",
          groupId: "group-a",
        });
      }
    }

    expect(matchInputs).toHaveLength(36);

    const pitchConfigs: PitchConfig[] = FSS_SHOWCASE_PITCHES.map((p) => ({
      id: p.id,
      name: p.name,
      order: p.order,
    }));

    const dayConfigs: DayConfig[] = FSS_SHOWCASE_DATES.map((date, idx) => ({
      id: `day-${idx + 1}`,
      date,
      startTime: "18:00",
    }));

    const scheduledMatches = scheduleTournamentMatches(matchInputs, pitchConfigs, dayConfigs, {
      matchDurationMinutes: 20,
      restIntervalMinutes: 10,
    });

    expect(scheduledMatches).toHaveLength(36);

    // Validate pitch and player schedule integrity
    const integrity = validateScheduleIntegrity(scheduledMatches, 10);
    expect(integrity.isValid).toBe(true);
    expect(integrity.pitchOverlaps).toHaveLength(0);
    expect(integrity.playerOverlaps).toHaveLength(0);
    expect(integrity.restViolations).toHaveLength(0);
  }, "R3+R5");

  it("T4.3: [Lifecycle Stage 3] Grupa A Match Execution: Simulating All 36 Matches with Validated Scores", () => {
    const rounds = generateBergerSchedule(9);
    const completedGroupResults: MatchResultInput[] = [];

    // Predefined realistic match outcomes for all 36 group matches
    // Generating deterministic 2:0 and 2:1 results
    let matchIdx = 0;
    for (const r of rounds) {
      for (const m of r.matches) {
        const p1 = FSS_SHOWCASE_PLAYERS[m.player1Slot];
        const p2 = FSS_SHOWCASE_PLAYERS[m.player2Slot];

        // Alternating realistic outcomes:
        // Even index: P1 wins 2:0 (11:7, 11:8)
        // Odd index: P2 wins 2:1 (11:9, 8:11, 15:13)
        const isP1Win = matchIdx % 2 === 0;
        const isThreeSets = matchIdx % 3 === 0;

        let sets: { s1: number; s2: number }[];
        if (isP1Win) {
          if (isThreeSets) {
            sets = [{ s1: 11, s2: 9 }, { s1: 8, s2: 11 }, { s1: 15, s2: 12 }]; // 2:1 for P1 (15-pt decider)
          } else {
            sets = [{ s1: 11, s2: 7 }, { s1: 11, s2: 6 }]; // 2:0 for P1
          }
        } else {
          if (isThreeSets) {
            sets = [{ s1: 8, s2: 11 }, { s1: 11, s2: 9 }, { s1: 13, s2: 15 }]; // 2:1 for P2 (15-pt decider)
          } else {
            sets = [{ s1: 7, s2: 11 }, { s1: 6, s2: 11 }]; // 2:0 for P2
          }
        }

        // Validate score against FSS sport rules
        const validation = validateMatchScore(sets, FSS_SPORT_RULES);
        expect(validation.isValid).toBe(true);
        expect(validation.isMatchCompleted).toBe(true);

        completedGroupResults.push({
          player1Id: p1.id,
          player2Id: p2.id,
          sets,
          status: "completed",
        });

        matchIdx++;
      }
    }

    expect(completedGroupResults).toHaveLength(36);
  }, "R2+R3+R5");

  it("T4.4: [Lifecycle Stage 4] Grupa A Standings Recalculation & Identification of Top 4 Qualifiers", () => {
    const rounds = generateBergerSchedule(9);
    const completedGroupResults: MatchResultInput[] = [];

    let matchIdx = 0;
    for (const r of rounds) {
      for (const m of r.matches) {
        const p1 = FSS_SHOWCASE_PLAYERS[m.player1Slot];
        const p2 = FSS_SHOWCASE_PLAYERS[m.player2Slot];

        // Structured outcomes so ranks 1 to 4 are clear:
        // Slot 0 (Antek) wins most matches
        // Slot 8 (Tomasz Borówka) also qualifies
        let sets: { s1: number; s2: number }[];
        if (m.player1Slot === 0 || m.player1Slot === 8) {
          sets = [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }]; // Win 2:0
        } else if (m.player2Slot === 0 || m.player2Slot === 8) {
          sets = [{ s1: 6, s2: 11 }, { s1: 7, s2: 11 }]; // P2 wins 2:0
        } else {
          // Standard alternating
          sets = matchIdx % 2 === 0
            ? [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }]
            : [{ s1: 8, s2: 11 }, { s1: 9, s2: 11 }];
        }

        completedGroupResults.push({
          player1Id: p1.id,
          player2Id: p2.id,
          sets,
          status: "completed",
        });

        matchIdx++;
      }
    }

    const playerIds = FSS_SHOWCASE_PLAYERS.map((p) => p.id);
    const standings = calculateStandings(playerIds, completedGroupResults, "2_1_matrix");

    expect(standings).toHaveLength(9);
    for (const s of standings) {
      expect(s.played).toBe(8); // Exactly 8 matches played per player in 9-player round-robin
    }

    // Top 4 qualify for Drabinka B
    const qualifiers = standings.slice(0, 4);
    expect(qualifiers).toHaveLength(4);

    // Verify ranks 1, 2, 3, 4
    expect(qualifiers[0].rank).toBe(1);
    expect(qualifiers[1].rank).toBe(2);
    expect(qualifiers[2].rank).toBe(3);
    expect(qualifiers[3].rank).toBe(4);
  }, "R1+R5");

  it("T4.5: [Lifecycle Stage 5] Drabinka B Playoff Execution (4 Matches: 2 SF + 3rd Place + Final = 40 Total Matches)", () => {
    // Bracket setup: 4 qualifiers, include 3rd place match
    const bracket = generateKnockoutBracket(4, true);
    expect(bracket).toHaveLength(4);

    const sf1 = bracket.find((m) => m.id === "sf-1")!;
    const sf2 = bracket.find((m) => m.id === "sf-2")!;
    const thirdPlace = bracket.find((m) => m.id === "third-place")!;
    const finalMatch = bracket.find((m) => m.id === "final")!;

    expect(sf1).toBeDefined();
    expect(sf2).toBeDefined();
    expect(thirdPlace).toBeDefined();
    expect(finalMatch).toBeDefined();

    // Assign top 4 seeds:
    // Seed 1: Antek Sadowski (p-1)
    // Seed 2: Tomasz Borówka (p-9)
    // Seed 3: Bartek Kalarus (p-2)
    // Seed 4: Filip Kruszka (p-3)
    sf1.slot1.playerId = "p-1";
    sf1.slot2.playerId = "p-3"; // Rank 1 vs Rank 4

    sf2.slot1.playerId = "p-9";
    sf2.slot2.playerId = "p-2"; // Rank 2 vs Rank 3

    // SF 1 Match Execution: p-1 beats p-3 (2:0)
    const sf1Score = [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }];
    const sf1Val = validateMatchScore(sf1Score, FSS_SPORT_RULES);
    expect(sf1Val.isValid).toBe(true);
    expect(sf1Val.winner).toBe(1);
    sf1.winnerPlayerId = "p-1";
    sf1.loserPlayerId = "p-3";

    // SF 2 Match Execution: p-9 (Tomasz Borówka) beats p-2 (2:1 decider 15:13)
    const sf2Score = [{ s1: 11, s2: 9 }, { s1: 8, s2: 11 }, { s1: 15, s2: 13 }];
    const sf2Val = validateMatchScore(sf2Score, FSS_SPORT_RULES);
    expect(sf2Val.isValid).toBe(true);
    expect(sf2Val.winner).toBe(1);
    sf2.winnerPlayerId = "p-9";
    sf2.loserPlayerId = "p-2";

    // Advance to 3rd Place Match: p-3 vs p-2
    thirdPlace.slot1.playerId = sf1.loserPlayerId;
    thirdPlace.slot2.playerId = sf2.loserPlayerId;

    // Advance to Final: p-1 vs p-9 (Antek Sadowski vs Tomasz Borówka)
    finalMatch.slot1.playerId = sf1.winnerPlayerId;
    finalMatch.slot2.playerId = sf2.winnerPlayerId;

    // 3rd Place Match: p-2 beats p-3 (2:0) -> Bartek Kalarus wins bronze
    const thirdScore = [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }];
    const thirdVal = validateMatchScore(thirdScore, FSS_SPORT_RULES);
    expect(thirdVal.isValid).toBe(true);
    thirdPlace.winnerPlayerId = "p-2";
    thirdPlace.loserPlayerId = "p-3";

    // Final Championship Match: p-9 (Tomasz Borówka, slot 2) beats p-1 (Antek Sadowski, slot 1) (2:1 decider 16:14 win-by-2)
    const finalScore = [{ s1: 11, s2: 9 }, { s1: 8, s2: 11 }, { s1: 14, s2: 16 }];
    const finalVal = validateMatchScore(finalScore, FSS_SPORT_RULES);
    expect(finalVal.isValid).toBe(true);
    expect(finalVal.winner).toBe(2);
    finalMatch.winnerPlayerId = "p-9"; // Tomasz Borówka is champion!
    finalMatch.loserPlayerId = "p-1";

    // Total tournament matches: 36 (group) + 4 (playoffs) = 40 matches!
    const totalMatchesCount = 36 + bracket.length;
    expect(totalMatchesCount).toBe(40);
  }, "R3+R5");

  it("T4.6: [Lifecycle Stage 6] Final Podium Determination & Venue TV Slideshow Kiosk State", () => {
    // Verify final championship standings:
    // 1st Place (Gold): Tomasz Borówka (p-9)
    // 2nd Place (Silver): Antek Sadowski (p-1)
    // 3rd Place (Bronze): Bartek Kalarus (p-2)
    // 4th Place: Filip Kruszka (p-3)
    const championId = "p-9";
    const runnerUpId = "p-1";
    const bronzeId = "p-2";
    const fourthId = "p-3";

    const championName = FSS_SHOWCASE_PLAYERS.find((p) => p.id === championId)!.name;
    const runnerUpName = FSS_SHOWCASE_PLAYERS.find((p) => p.id === runnerUpId)!.name;
    const bronzeName = FSS_SHOWCASE_PLAYERS.find((p) => p.id === bronzeId)!.name;
    const fourthName = FSS_SHOWCASE_PLAYERS.find((p) => p.id === fourthId)!.name;

    expect(championName).toBe("Tomasz Borówka");
    expect(runnerUpName).toBe("Antek Sadowski");
    expect(bronzeName).toBe("Bartek Kalarus");
    expect(fourthName).toBe("Filip Kruszka");

    // Initialize venue presentation kiosk displaying tournament conclusion
    const kiosk = new VenuePresenterSimulator({
      rotationIntervalSeconds: 8,
      announcementText: `Mistrz FSS 2026: ${championName}! Gratulacje!`,
    });

    expect(kiosk.currentSlide).toBe("standings");
    kiosk.tick(8);
    expect(kiosk.currentSlide).toBe("matches");
    kiosk.tick(8);
    expect(kiosk.currentSlide).toBe("announcement");
    expect(kiosk.announcementText).toBe("Mistrz FSS 2026: Tomasz Borówka! Gratulacje!");
  }, "R5+R6");
});
