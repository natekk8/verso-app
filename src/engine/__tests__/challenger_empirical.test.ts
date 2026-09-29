import { describe, it, expect } from "vitest";
import {
  generateBergerSchedule,
  generateBergerMatchesWithPlayers,
  BergerRound,
} from "../berger";
import {
  generateKnockoutBracket,
  propagateKnockoutResults,
  populateGroupRankings,
  KnockoutMatch,
} from "../knockout";

describe("Challenger Empirical Suite: Berger Round-Robin Engine", () => {
  describe("Invariant verification across all N in [2, 32]", () => {
    for (let N = 2; N <= 32; N++) {
      it(`verifies all mathematical invariants for N = ${N} participants`, () => {
        const isOdd = N % 2 !== 0;
        const expectedRounds = isOdd ? N : N - 1;
        const expectedMatchesPerRound = isOdd ? (N - 1) / 2 : N / 2;
        const expectedTotalMatches = (N * (N - 1)) / 2;

        const rounds = generateBergerSchedule(N);

        // 1. Correct number of rounds
        expect(rounds).toHaveLength(expectedRounds);

        let totalMatches = 0;
        const pairCountMap = new Map<string, number>();
        const byeCountMap = new Map<number, number>();

        // Pre-initialize pairs
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            pairCountMap.set(`${i}-${j}`, 0);
          }
          byeCountMap.set(i, 0);
        }

        rounds.forEach((round, rIdx) => {
          // Round numbering is 1-indexed and sequential
          expect(round.roundNumber).toBe(rIdx + 1);

          // Matches per round count
          expect(round.matches).toHaveLength(expectedMatchesPerRound);
          totalMatches += round.matches.length;

          // Bye verification per round
          if (isOdd) {
            expect(round.byePlayerSlot).toBeDefined();
            expect(typeof round.byePlayerSlot).toBe("number");
            expect(Number.isInteger(round.byePlayerSlot)).toBe(true);
            expect(Number.isNaN(round.byePlayerSlot)).toBe(false);
            expect(round.byePlayerSlot).toBeGreaterThanOrEqual(0);
            expect(round.byePlayerSlot).toBeLessThan(N);

            const byeSlot = round.byePlayerSlot!;
            byeCountMap.set(byeSlot, (byeCountMap.get(byeSlot) ?? 0) + 1);
          } else {
            expect(round.byePlayerSlot).toBeUndefined();
          }

          // Concurrency check within round: each player appears at most once
          const playersActiveInRound = new Set<number>();
          if (isOdd && round.byePlayerSlot !== undefined) {
            playersActiveInRound.add(round.byePlayerSlot);
          }

          round.matches.forEach((m, mIdx) => {
            // Match indexing
            expect(m.round).toBe(round.roundNumber);
            expect(m.matchInRound).toBe(mIdx + 1);
            expect(m.isBye).toBe(false);

            // Valid slot indices
            expect(typeof m.player1Slot).toBe("number");
            expect(typeof m.player2Slot).toBe("number");
            expect(Number.isNaN(m.player1Slot)).toBe(false);
            expect(Number.isNaN(m.player2Slot)).toBe(false);
            expect(m.player1Slot).toBeGreaterThanOrEqual(0);
            expect(m.player1Slot).toBeLessThan(N);
            expect(m.player2Slot).toBeGreaterThanOrEqual(0);
            expect(m.player2Slot).toBeLessThan(N);

            // Distinct players in a match
            expect(m.player1Slot).not.toBe(m.player2Slot);

            // No player can play twice in the same round or play and have a bye
            expect(playersActiveInRound.has(m.player1Slot)).toBe(false);
            expect(playersActiveInRound.has(m.player2Slot)).toBe(false);
            playersActiveInRound.add(m.player1Slot);
            playersActiveInRound.add(m.player2Slot);

            // Record pair
            const canonicalPair = [m.player1Slot, m.player2Slot].sort((a, b) => a - b).join("-");
            expect(pairCountMap.has(canonicalPair)).toBe(true);
            pairCountMap.set(canonicalPair, (pairCountMap.get(canonicalPair) ?? 0) + 1);
          });

          // Exactly all N players accounted for in every round
          expect(playersActiveInRound.size).toBe(N);
        });

        // 2. Total matches must match N*(N-1)/2
        expect(totalMatches).toBe(expectedTotalMatches);

        // 3. Every distinct pair plays EXACTLY ONCE
        pairCountMap.forEach((count, pair) => {
          expect(count).toBe(1);
        });

        // 4. For odd N, every player gets EXACTLY ONE bye
        if (isOdd) {
          byeCountMap.forEach((count, playerSlot) => {
            expect(count).toBe(1);
          });
        }
      });
    }
  });

  describe("N = 9 Acceptance Criteria Specific Test", () => {
    it("satisfies all N=9 requirements: 9 rounds, 4 matches/round, 36 total, 1 bye/round", () => {
      const rounds = generateBergerSchedule(9);
      expect(rounds).toHaveLength(9);

      let totalMatches = 0;
      const byes: number[] = [];

      rounds.forEach((r) => {
        expect(r.matches).toHaveLength(4);
        totalMatches += r.matches.length;
        expect(r.byePlayerSlot).toBeDefined();
        byes.push(r.byePlayerSlot!);
      });

      expect(totalMatches).toBe(36);
      expect(byes).toHaveLength(9);
      expect(new Set(byes).size).toBe(9);
      for (let p = 0; p < 9; p++) {
        expect(byes).toContain(p);
      }
    });
  });

  describe("Boundary & Edge Case Inputs", () => {
    it("handles N = 0 without error", () => {
      expect(generateBergerSchedule(0)).toEqual([]);
    });

    it("handles N = 1 without error", () => {
      const schedule = generateBergerSchedule(1);
      expect(schedule).toHaveLength(1);
      expect(schedule[0].roundNumber).toBe(1);
      expect(schedule[0].matches).toEqual([]);
      expect(schedule[0].byePlayerSlot).toBe(0);
    });

    it("handles negative values safely", () => {
      expect(generateBergerSchedule(-1)).toEqual([]);
      expect(generateBergerSchedule(-10)).toEqual([]);
    });

    it("includeByeInMatches flag includes virtual bye matches", () => {
      const rounds = generateBergerSchedule(5, { includeByeInMatches: true });
      expect(rounds).toHaveLength(5);
      rounds.forEach((r) => {
        // 2 playable matches + 1 bye match = 3
        expect(r.matches).toHaveLength(3);
        const byeMatches = r.matches.filter((m) => m.isBye);
        expect(byeMatches).toHaveLength(1);
        expect(byeMatches[0].player2Slot).toBe(-1);
      });
    });
  });
});

describe("Challenger Empirical Suite: Knockout Engine & DAG Propagation", () => {
  const bracketSizes = [2, 4, 8, 16, 32, 64];

  describe("Knockout Bracket Generation Structure", () => {
    for (const size of bracketSizes) {
      it(`tests structural properties for bracket size ${size}`, () => {
        const matchesWithThirdPlace = generateKnockoutBracket(size, true);
        const matchesWithoutThirdPlace = generateKnockoutBracket(size, false);

        // Third place match is included only if size >= 4
        const expectedWithThirdPlace = size === 2 ? 1 : size;
        const expectedWithoutThirdPlace = size - 1;

        expect(matchesWithThirdPlace).toHaveLength(expectedWithThirdPlace);
        expect(matchesWithoutThirdPlace).toHaveLength(expectedWithoutThirdPlace);

        // Match ID uniqueness check
        const matchIds = matchesWithThirdPlace.map((m) => m.id);
        const uniqueMatchIds = new Set(matchIds);
        expect(uniqueMatchIds.size).toBe(matchIds.length);

        // Slot ID uniqueness check
        const slotIds = matchesWithThirdPlace.flatMap((m) => [m.slot1.slotId, m.slot2.slotId]);
        const uniqueSlotIds = new Set(slotIds);
        expect(uniqueSlotIds.size).toBe(slotIds.length);

        // Seeding check for round 1
        const r1Matches = matchesWithThirdPlace.filter(
          (m) => m.slot1.sourceType === "group_rank" && m.slot2.sourceType === "group_rank"
        );
        expect(r1Matches).toHaveLength(size / 2);

        // Verify seed 1 and seed 2 are in separate halves of the bracket
        const seed1Match = r1Matches.find(
          (m) => m.slot1.sourceRef.startsWith("1.") || m.slot2.sourceRef.startsWith("1.")
        );
        const seed2Match = r1Matches.find(
          (m) => m.slot1.sourceRef.startsWith("2.") || m.slot2.sourceRef.startsWith("2.")
        );
        expect(seed1Match).toBeDefined();
        expect(seed2Match).toBeDefined();
        if (size >= 4) {
          expect(seed1Match!.id).not.toBe(seed2Match!.id);
        }

        // Check for round names
        matchesWithThirdPlace.forEach((m) => {
          expect(m.roundName).toBeDefined();
          expect(typeof m.roundName).toBe("string");
        });
      });
    }
  });

  describe("Knockout DAG Propagation Stress Test up to 64 Players", () => {
    for (const size of [2, 4, 8, 16, 32, 64]) {
      it(`simulates complete tournament DAG propagation for ${size} players with 10 random runs`, () => {
        for (let run = 0; run < 10; run++) {
          const players = Array.from({ length: size }, (_, i) => `player_${i + 1}`);
          const rankings = players.map((p, idx) => ({
            rank: idx + 1,
            playerId: p,
          }));

          let bracket = generateKnockoutBracket(size, size >= 4);

          // 1. Initial population from rankings
          bracket = populateGroupRankings(bracket, rankings);

          // Verify all Round 1 slots are populated
          const r1Matches = bracket.filter(
            (m) => m.slot1.sourceType === "group_rank" && m.slot2.sourceType === "group_rank"
          );
          r1Matches.forEach((m) => {
            expect(m.slot1.playerId).toBeDefined();
            expect(m.slot2.playerId).toBeDefined();
            expect(m.slot1.playerId).not.toBe(m.slot2.playerId);
          });

          // 2. Play out the tournament round by round
          const results: Record<string, { winnerPlayerId: string; loserPlayerId: string }> = {};

          let playableMatchesExist = true;
          let roundsPlayed = 0;
          const maxRounds = Math.ceil(Math.log2(size)) + 2; // Guard against infinite loop

          while (playableMatchesExist && roundsPlayed < maxRounds) {
            roundsPlayed++;
            // Find matches that have both players populated but no recorded result yet
            const readyMatches = bracket.filter(
              (m) => m.slot1.playerId && m.slot2.playerId && !results[m.id]
            );

            if (readyMatches.length === 0) {
              playableMatchesExist = false;
              break;
            }

            // Decide winners for ready matches
            for (const match of readyMatches) {
              const p1 = match.slot1.playerId!;
              const p2 = match.slot2.playerId!;
              // Randomized 50/50 winner selection
              const winner = Math.random() < 0.5 ? p1 : p2;
              const loser = winner === p1 ? p2 : p1;

              results[match.id] = { winnerPlayerId: winner, loserPlayerId: loser };
            }

            // Propagate results through DAG
            bracket = propagateKnockoutResults(bracket, results);
          }

          // Verify Final match was played and has a winner
          const finalMatch = bracket.find((m) => m.roundName === "final" || m.id === "final")!;
          expect(finalMatch).toBeDefined();
          expect(finalMatch.winnerPlayerId).toBeDefined();
          expect(finalMatch.loserPlayerId).toBeDefined();
          expect(finalMatch.winnerPlayerId).not.toBe(finalMatch.loserPlayerId);

          // Verify Third Place match (if applicable) was played and has a winner
          if (size >= 4) {
            const thirdPlaceMatch = bracket.find((m) => m.id === "third-place")!;
            expect(thirdPlaceMatch).toBeDefined();
            expect(thirdPlaceMatch.winnerPlayerId).toBeDefined();
            expect(thirdPlaceMatch.loserPlayerId).toBeDefined();
            expect(thirdPlaceMatch.winnerPlayerId).not.toBe(thirdPlaceMatch.loserPlayerId);

            // Third place participants must be the semifinal losers
            const semifinalMatches = bracket.filter((m) => m.roundName === "semifinals" || m.id.startsWith("sf-"));
            const sfLosers = semifinalMatches.map((sf) => results[sf.id]?.loserPlayerId);
            expect(sfLosers).toContain(thirdPlaceMatch.slot1.playerId);
            expect(sfLosers).toContain(thirdPlaceMatch.slot2.playerId);
          }

          // Invariant: Champion must be one of the original participants
          expect(players).toContain(finalMatch.winnerPlayerId);

          // Invariant: Champion must never have lost any match
          for (const res of Object.values(results)) {
            expect(res.loserPlayerId).not.toBe(finalMatch.winnerPlayerId);
          }
        }
      });
    }
  });

  describe("Edge cases and non-standard qualifier counts", () => {
    it("handles qualifierCount = 1 by returning empty bracket", () => {
      expect(generateKnockoutBracket(1)).toEqual([]);
    });

    it("handles qualifierCount = 0 by returning empty bracket", () => {
      expect(generateKnockoutBracket(0)).toEqual([]);
    });

    it("handles negative qualifierCount by returning empty bracket", () => {
      expect(generateKnockoutBracket(-4)).toEqual([]);
    });

    it("handles non-power-of-2 qualifiers like 6", () => {
      const bracket = generateKnockoutBracket(6);
      expect(bracket.length).toBeGreaterThan(0);
      // Bracket size should be rounded up to 8
      expect(bracket).toHaveLength(8);
    });
  });
});
