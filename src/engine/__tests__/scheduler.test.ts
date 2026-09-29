import { describe, it, expect } from "vitest";
import {
  scheduleTournamentMatches,
  validateScheduleIntegrity,
  MatchInput,
  PitchConfig,
  DayConfig,
} from "../scheduler";
import { generateBergerSchedule } from "../berger";

describe("Pitch and Time Scheduler Engine", () => {
  const pitches: PitchConfig[] = [
    { id: "pitch-1", name: "Stół 1", order: 1 },
    { id: "pitch-2", name: "Stół 2", order: 2 },
  ];

  const days: DayConfig[] = [
    { id: "day-1", date: "2026-10-02", startTime: "18:00" },
    { id: "day-2", date: "2026-10-03", startTime: "18:00" },
    { id: "day-3", date: "2026-10-04", startTime: "18:00" },
    { id: "day-4", date: "2026-10-16", startTime: "18:00" },
    { id: "day-5", date: "2026-10-17", startTime: "18:00" },
  ];

  describe("FSS Showcase Tournament Workload (36 Group Matches, 2 Pitches, 5 Days)", () => {
    it("allocates all matches with 100% zero player concurrency and valid rest intervals", () => {
      // Generate 36 matches for 9 players
      const rounds = generateBergerSchedule(9);
      const matches: MatchInput[] = [];
      let matchCounter = 1;

      for (const round of rounds) {
        for (const m of round.matches) {
          matches.push({
            id: `match-${matchCounter++}`,
            round: m.round,
            player1Id: `p-${m.player1Slot}`,
            player2Id: `p-${m.player2Slot}`,
          });
        }
      }

      expect(matches).toHaveLength(36);

      const scheduled = scheduleTournamentMatches(matches, pitches, days, {
        matchDurationMinutes: 20,
        restIntervalMinutes: 10,
      });

      expect(scheduled).toHaveLength(36);

      // Verify integrity with automated QA validator
      const integrity = validateScheduleIntegrity(scheduled, 10);
      expect(integrity.pitchOverlaps).toEqual([]);
      expect(integrity.playerOverlaps).toEqual([]);
      expect(integrity.restViolations).toEqual([]);
      expect(integrity.isValid).toBe(true);

      // Verify all matches have valid pitches and dates
      scheduled.forEach((m) => {
        expect(["pitch-1", "pitch-2"]).toContain(m.pitchId);
        expect(days.map((d) => d.date)).toContain(m.date);
        expect(m.startTimestamp).toBeLessThan(m.endTimestamp);
      });
    });
  });

  describe("Tight Consecutive Match Scenarios", () => {
    it("enforces minimum rest interval for players scheduled back-to-back", () => {
      const tightMatches: MatchInput[] = [
        { id: "m1", round: 1, player1Id: "player-a", player2Id: "player-b" },
        // player-a plays again immediately in next match:
        { id: "m2", round: 1, player1Id: "player-a", player2Id: "player-c" },
      ];

      const singleDay: DayConfig[] = [
        { id: "day-1", date: "2026-10-02", startTime: "18:00" },
      ];

      const scheduled = scheduleTournamentMatches(tightMatches, pitches, singleDay, {
        matchDurationMinutes: 20,
        restIntervalMinutes: 15,
      });

      expect(scheduled).toHaveLength(2);

      const m1 = scheduled.find((m) => m.matchId === "m1")!;
      const m2 = scheduled.find((m) => m.matchId === "m2")!;

      // m1: 18:00 - 18:20
      expect(m1.startTime).toBe("18:00");
      expect(m1.endTime).toBe("18:20");

      // m2 involves player-a: cannot start until 18:20 + 15 min rest = 18:35!
      expect(m2.startTime).toBe("18:35");
      expect(m2.endTime).toBe("18:55");

      const integrity = validateScheduleIntegrity(scheduled, 15);
      expect(integrity.isValid).toBe(true);
    });

    it("allows independent players to start simultaneously on available pitches", () => {
      const parallelMatches: MatchInput[] = [
        { id: "m1", round: 1, player1Id: "player-a", player2Id: "player-b" },
        { id: "m2", round: 1, player1Id: "player-c", player2Id: "player-d" },
      ];

      const singleDay: DayConfig[] = [
        { id: "day-1", date: "2026-10-02", startTime: "18:00" },
      ];

      const scheduled = scheduleTournamentMatches(parallelMatches, pitches, singleDay, {
        matchDurationMinutes: 20,
        restIntervalMinutes: 10,
      });

      expect(scheduled).toHaveLength(2);

      // Because players are disjoint, both can start at 18:00 on separate pitches!
      expect(scheduled[0].startTime).toBe("18:00");
      expect(scheduled[1].startTime).toBe("18:00");
      expect(scheduled[0].pitchId).not.toBe(scheduled[1].pitchId);
    });
  });

  describe("Edge cases", () => {
    it("returns empty schedule when matches or pitches or days are empty", () => {
      expect(scheduleTournamentMatches([], pitches, days)).toEqual([]);
      expect(scheduleTournamentMatches([{ id: "m1", round: 1, player1Id: "a", player2Id: "b" }], [], days)).toEqual([]);
      expect(scheduleTournamentMatches([{ id: "m1", round: 1, player1Id: "a", player2Id: "b" }], pitches, [])).toEqual([]);
    });
  });
});
