import { describe, it, expect } from "vitest";
import {
  generateBergerSchedule,
  generateBergerMatchesWithPlayers,
  BergerRound,
} from "../berger";

describe("Berger Round-Robin Pairing Engine", () => {
  describe("N = 9 Participants (Mandatory Acceptance Criteria)", () => {
    it("generates exactly 9 rounds, 4 matches per round (36 total), and exactly 1 bye per round", () => {
      const rounds = generateBergerSchedule(9);

      // 1. Verify exactly 9 rounds
      expect(rounds).toHaveLength(9);

      let totalMatches = 0;
      const byeSlots: number[] = [];
      const pairedKeys = new Set<string>();

      rounds.forEach((round: BergerRound, roundIdx: number) => {
        // Round numbers must be 1-indexed
        expect(round.roundNumber).toBe(roundIdx + 1);

        // Exactly 4 matches per round
        expect(round.matches).toHaveLength(4);
        totalMatches += round.matches.length;

        // Exactly 1 bye per round
        expect(round.byePlayerSlot).toBeDefined();
        expect(typeof round.byePlayerSlot).toBe("number");
        expect(round.byePlayerSlot).toBeGreaterThanOrEqual(0);
        expect(round.byePlayerSlot).toBeLessThan(9);
        byeSlots.push(round.byePlayerSlot!);

        // Check each match within the round
        const playersInThisRound = new Set<number>();
        playersInThisRound.add(round.byePlayerSlot!);

        round.matches.forEach((m) => {
          expect(m.round).toBe(round.roundNumber);
          expect(m.isBye).toBe(false);
          expect(m.player1Slot).not.toBe(m.player2Slot);

          // No player can play twice in the same round or play and have a bye
          expect(playersInThisRound.has(m.player1Slot)).toBe(false);
          expect(playersInThisRound.has(m.player2Slot)).toBe(false);
          playersInThisRound.add(m.player1Slot);
          playersInThisRound.add(m.player2Slot);

          // Record canonical pairing {min, max}
          const pairKey = [m.player1Slot, m.player2Slot].sort((a, b) => a - b).join("-");
          expect(pairedKeys.has(pairKey)).toBe(false);
          pairedKeys.add(pairKey);
        });

        // All 9 participants must be accounted for in every round (8 playing + 1 bye)
        expect(playersInThisRound.size).toBe(9);
      });

      // 2. Exactly 36 matches total (9 * 8 / 2 = 36)
      expect(totalMatches).toBe(36);
      expect(pairedKeys.size).toBe(36);

      // 3. Every pair of distinct players plays each other once
      for (let i = 0; i < 9; i++) {
        for (let j = i + 1; j < 9; j++) {
          expect(pairedKeys.has(`${i}-${j}`)).toBe(true);
        }
      }

      // 4. Exactly one bye per round, and every player gets a bye across the 9 rounds
      expect(byeSlots).toHaveLength(9);
      const uniqueByes = new Set(byeSlots);
      expect(uniqueByes.size).toBe(9);
      for (let p = 0; p < 9; p++) {
        expect(uniqueByes.has(p)).toBe(true);
      }
    });

    it("works with generateBergerMatchesWithPlayers helper", () => {
      const players = [
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

      const result = generateBergerMatchesWithPlayers(players);
      expect(result.rounds).toHaveLength(9);
      expect(result.matches).toHaveLength(36);
      expect(result.byes).toHaveLength(9);

      // Check that Tomasz Borówka has a bye in one of the rounds
      const tomaszBye = result.byes.find((b) => b.player === "Tomasz Borówka");
      expect(tomaszBye).toBeDefined();

      // Check all matches have valid player objects
      result.matches.forEach((m) => {
        expect(players).toContain(m.player1);
        expect(players).toContain(m.player2);
        expect(m.player1).not.toBe(m.player2);
      });
    });
  });

  describe("Even participant counts", () => {
    it("generates correct schedule for N = 4 (3 rounds, 2 matches/round, 6 total, 0 byes)", () => {
      const rounds = generateBergerSchedule(4);

      expect(rounds).toHaveLength(3);
      let totalMatches = 0;
      const pairs = new Set<string>();

      rounds.forEach((round) => {
        expect(round.matches).toHaveLength(2);
        expect(round.byePlayerSlot).toBeUndefined();
        totalMatches += round.matches.length;

        round.matches.forEach((m) => {
          const key = [m.player1Slot, m.player2Slot].sort((a, b) => a - b).join("-");
          expect(pairs.has(key)).toBe(false);
          pairs.add(key);
        });
      });

      expect(totalMatches).toBe(6);
      expect(pairs.size).toBe(6);
    });

    it("generates correct schedule for N = 8 (7 rounds, 4 matches/round, 28 total, 0 byes)", () => {
      const rounds = generateBergerSchedule(8);

      expect(rounds).toHaveLength(7);
      let totalMatches = 0;
      const pairs = new Set<string>();

      rounds.forEach((round) => {
        expect(round.matches).toHaveLength(4);
        expect(round.byePlayerSlot).toBeUndefined();
        totalMatches += round.matches.length;

        round.matches.forEach((m) => {
          const key = [m.player1Slot, m.player2Slot].sort((a, b) => a - b).join("-");
          expect(pairs.has(key)).toBe(false);
          pairs.add(key);
        });
      });

      expect(totalMatches).toBe(28);
      expect(pairs.size).toBe(28);
    });
  });

  describe("Odd participant counts and edge cases", () => {
    it("handles N = 3 (3 rounds, 1 match/round, 3 total matches, 1 bye/round)", () => {
      const rounds = generateBergerSchedule(3);
      expect(rounds).toHaveLength(3);
      let totalMatches = 0;
      const byes = new Set<number>();

      rounds.forEach((r) => {
        expect(r.matches).toHaveLength(1);
        expect(r.byePlayerSlot).toBeDefined();
        byes.add(r.byePlayerSlot!);
        totalMatches += r.matches.length;
      });

      expect(totalMatches).toBe(3);
      expect(byes.size).toBe(3);
    });

    it("handles N = 5 (5 rounds, 2 matches/round, 10 total matches, 1 bye/round)", () => {
      const rounds = generateBergerSchedule(5);
      expect(rounds).toHaveLength(5);
      let totalMatches = 0;
      const pairs = new Set<string>();
      const byes = new Set<number>();

      rounds.forEach((r) => {
        expect(r.matches).toHaveLength(2);
        byes.add(r.byePlayerSlot!);
        totalMatches += r.matches.length;

        r.matches.forEach((m) => {
          pairs.add([m.player1Slot, m.player2Slot].sort((a, b) => a - b).join("-"));
        });
      });

      expect(totalMatches).toBe(10);
      expect(pairs.size).toBe(10);
      expect(byes.size).toBe(5);
    });

    it("handles N = 1 (1 round, 0 matches, 1 bye)", () => {
      const rounds = generateBergerSchedule(1);
      expect(rounds).toHaveLength(1);
      expect(rounds[0].matches).toHaveLength(0);
      expect(rounds[0].byePlayerSlot).toBe(0);
    });

    it("handles N = 0 (empty)", () => {
      const rounds = generateBergerSchedule(0);
      expect(rounds).toEqual([]);
    });

    it("supports optional includeByeInMatches flag", () => {
      const rounds = generateBergerSchedule(3, { includeByeInMatches: true });
      expect(rounds).toHaveLength(3);
      rounds.forEach((r) => {
        // 1 playable match + 1 bye match
        expect(r.matches).toHaveLength(2);
        const byeMatch = r.matches.find((m) => m.isBye);
        expect(byeMatch).toBeDefined();
      });
    });
  });
});
