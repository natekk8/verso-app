import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import { PlayerTerminal, useCountdown } from "../PlayerTerminal";
import { AdminHub } from "../AdminHub";
import { SpectatorPortal } from "../SpectatorPortal";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
  MatchDoc,
  PlayerDoc,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";
import { validateScheduleIntegrity, ScheduledMatch } from "../../engine/scheduler";
import { calculateStandings, MatchResultInput } from "../../engine/standings";

describe("Challenger M4-2: Empirical Stress Test Suite", () => {
  let mockStore: MockConvexStore;
  let tournamentData: FullTournamentData;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
    tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Section 1: PlayerTerminal Live Countdown Timer Stress Testing
  // ==========================================================================
  describe("1. PlayerTerminal Live Countdown Timer Behavior", () => {
    it("1.1 useCountdown: correctly calculates HH:MM:SS for future timestamps", () => {
      const now = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      // Future match 2h 15m 30s away = 8130 seconds
      const targetTs = now + 8130 * 1000;

      let hookResult: any;
      const TestComponent = () => {
        hookResult = useCountdown(targetTs);
        return <div>{hookResult.hours}:{hookResult.minutes}:{hookResult.seconds}</div>;
      };

      const { unmount } = render(<TestComponent />);

      expect(hookResult.isPast).toBe(false);
      expect(hookResult.totalSeconds).toBe(8130);
      expect(hookResult.hours).toBe("02");
      expect(hookResult.minutes).toBe("15");
      expect(hookResult.seconds).toBe("30");

      unmount();
      vi.restoreAllMocks();
    });

    it("1.2 useCountdown: transitions to isPast when timestamp is in past or null", () => {
      const now = 5000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      let hookResultPast: any;
      let hookResultNull: any;

      const TestComponent = () => {
        hookResultPast = useCountdown(now - 10000);
        hookResultNull = useCountdown(null);
        return <div>Testing Past</div>;
      };

      const { unmount } = render(<TestComponent />);

      expect(hookResultPast.isPast).toBe(true);
      expect(hookResultPast.totalSeconds).toBe(0);
      expect(hookResultPast.hours).toBe("00");
      expect(hookResultPast.minutes).toBe("00");
      expect(hookResultPast.seconds).toBe("00");

      expect(hookResultNull.isPast).toBe(true);
      expect(hookResultNull.totalSeconds).toBe(0);

      unmount();
      vi.restoreAllMocks();
    });

    it("1.3 PlayerTerminal Spotlight: renders live countdown (HH:MM:SS) for future pending matches", async () => {
      // Find upcoming match for Tomasz Borówka
      const tomasz = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka")!;
      const match = Array.from(mockStore.matches.values()).find(
        (m) => (m.player1Id === tomasz._id || m.player2Id === tomasz._id) && m.status !== "completed"
      )!;

      // Set match timestamp 1 hour in the future
      const futureTs = Date.now() + 3600 * 1000;
      match.startTimestamp = futureTs;
      match.status = "pending";
      mockStore.matches.set(match._id, { ...match });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${tomasz.secretCode}`}>
            <PlayerTerminal tournament={tournamentData} playerSecret={tomasz.secretCode} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Czas do rozpoczęcia")).toBeDefined();
        expect(screen.getByText("godz")).toBeDefined();
        expect(screen.getByText("min")).toBeDefined();
        expect(screen.getByText("sek")).toBeDefined();
      });
    });

    it("1.4 PlayerTerminal Spotlight: renders 'Mecz na żywo • Trwa gra' when status is in_progress", async () => {
      const tomasz = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka")!;
      const match = Array.from(mockStore.matches.values()).find(
        (m) => (m.player1Id === tomasz._id || m.player2Id === tomasz._id) && m.roundNumber === 1
      )!;

      match.status = "in_progress";
      mockStore.matches.set(match._id, { ...match });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${tomasz.secretCode}`}>
            <PlayerTerminal tournament={tournamentData} playerSecret={tomasz.secretCode} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Mecz na żywo • Trwa gra/)).toBeDefined();
      });
    });

    it("1.5 PlayerTerminal Spotlight: renders 'Czas na rozpoczęcie meczu • Zgłoś się do stołu' when scheduled time is in past", async () => {
      const tomasz = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka")!;
      const match = Array.from(mockStore.matches.values()).find(
        (m) => (m.player1Id === tomasz._id || m.player2Id === tomasz._id) && m.roundNumber === 1
      )!;

      // Set timestamp in past (10 minutes ago) and status pending
      match.startTimestamp = Date.now() - 600 * 1000;
      match.status = "pending";
      mockStore.matches.set(match._id, { ...match });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${tomasz.secretCode}`}>
            <PlayerTerminal tournament={tournamentData} playerSecret={tomasz.secretCode} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Czas na rozpoczęcie meczu • Zgłoś się do stołu/)
        ).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Section 2: AdminHub Schedule Matrix Rest Conflict Detection (<10 mins)
  // ==========================================================================
  describe("2. AdminHub Schedule Matrix Rest Conflict Detection (<10 mins)", () => {
    it("2.1 validateScheduleIntegrity: detects rest violations for rest intervals < 10 mins", () => {
      const baseTs = Date.parse("2026-10-02T18:00:00Z");

      // Match 1: 18:00 - 18:20 (20 min)
      const m1: ScheduledMatch = {
        matchId: "m1",
        round: 1,
        player1Id: "p1",
        player2Id: "p2",
        dayId: "d1",
        date: "2026-10-02",
        pitchId: "pitch_1",
        pitchName: "Stół 1",
        startTime: "18:00",
        endTime: "18:20",
        startTimestamp: baseTs,
        endTimestamp: baseTs + 20 * 60 * 1000,
      };

      // Match 2 with only 5 min gap: 18:25 - 18:45
      const m2_5minGap: ScheduledMatch = {
        matchId: "m2",
        round: 2,
        player1Id: "p1", // same player p1!
        player2Id: "p3",
        dayId: "d1",
        date: "2026-10-02",
        pitchId: "pitch_2",
        pitchName: "Stół 2",
        startTime: "18:25",
        endTime: "18:45",
        startTimestamp: baseTs + 25 * 60 * 1000,
        endTimestamp: baseTs + 45 * 60 * 1000,
      };

      const result5min = validateScheduleIntegrity([m1, m2_5minGap], 10);
      expect(result5min.isValid).toBe(false);
      expect(result5min.restViolations.length).toBe(1);
      expect(result5min.restViolations[0]).toContain("gap is 5 min (required: 10)");

      // Match 2 with 0 min gap (consecutive: 18:20 - 18:40)
      const m2_0minGap: ScheduledMatch = {
        ...m2_5minGap,
        startTime: "18:20",
        endTime: "18:40",
        startTimestamp: baseTs + 20 * 60 * 1000,
        endTimestamp: baseTs + 40 * 60 * 1000,
      };
      const result0min = validateScheduleIntegrity([m1, m2_0minGap], 10);
      expect(result0min.isValid).toBe(false);
      expect(result0min.restViolations.length).toBe(1);
      expect(result0min.restViolations[0]).toContain("gap is 0 min (required: 10)");

      // Match 2 with 9 min gap: 18:29 - 18:49
      const m2_9minGap: ScheduledMatch = {
        ...m2_5minGap,
        startTime: "18:29",
        endTime: "18:49",
        startTimestamp: baseTs + 29 * 60 * 1000,
        endTimestamp: baseTs + 49 * 60 * 1000,
      };
      const result9min = validateScheduleIntegrity([m1, m2_9minGap], 10);
      expect(result9min.isValid).toBe(false);
      expect(result9min.restViolations.length).toBe(1);
      expect(result9min.restViolations[0]).toContain("gap is 9 min (required: 10)");

      // Match 2 with exactly 10 min gap: 18:30 - 18:50 -> Compliant!
      const m2_10minGap: ScheduledMatch = {
        ...m2_5minGap,
        startTime: "18:30",
        endTime: "18:50",
        startTimestamp: baseTs + 30 * 60 * 1000,
        endTimestamp: baseTs + 50 * 60 * 1000,
      };
      const result10min = validateScheduleIntegrity([m1, m2_10minGap], 10);
      expect(result10min.isValid).toBe(true);
      expect(result10min.restViolations.length).toBe(0);

      // Matches on different days: NO rest violation across different dates
      const m2_nextDay: ScheduledMatch = {
        ...m2_5minGap,
        date: "2026-10-03",
        dayId: "d2",
      };
      const resultDifferentDay = validateScheduleIntegrity([m1, m2_nextDay], 10);
      expect(resultDifferentDay.isValid).toBe(true);
      expect(resultDifferentDay.restViolations.length).toBe(0);
    });

    it("2.2 AdminHub UI: displays rest conflict warning banner and highlights conflicting match card", async () => {
      const p1 = Array.from(mockStore.players.values())[0];
      const p2 = Array.from(mockStore.players.values())[1];
      const p3 = Array.from(mockStore.players.values())[2];
      const day1 = Array.from(mockStore.days.values())[0];
      const pitch1 = Array.from(mockStore.pitches.values())[0];
      const pitch2 = Array.from(mockStore.pitches.values())[1];

      // Inject 4-minute rest violation for player p1
      mockStore.matches.set("conflict_m1", {
        _id: "conflict_m1",
        _creationTime: Date.now(),
        tournamentId: tournamentData._id,
        stageId: "stage_1",
        dayId: day1._id,
        pitchId: pitch1._id,
        time: "18:00",
        endTime: "18:20",
        startTimestamp: Date.parse(`${day1.date}T18:00:00Z`),
        endTimestamp: Date.parse(`${day1.date}T18:20:00Z`),
        roundNumber: 1,
        player1Id: p1._id,
        player2Id: p2._id,
        sets: [],
        status: "pending",
      });

      mockStore.matches.set("conflict_m2", {
        _id: "conflict_m2",
        _creationTime: Date.now(),
        tournamentId: tournamentData._id,
        stageId: "stage_1",
        dayId: day1._id,
        pitchId: pitch2._id,
        time: "18:22", // Gap is only 2 minutes (< 10 min rest interval!)
        endTime: "18:42",
        startTimestamp: Date.parse(`${day1.date}T18:22:00Z`),
        endTimestamp: Date.parse(`${day1.date}T18:42:00Z`),
        roundNumber: 2,
        player1Id: p1._id, // Same player p1
        player2Id: p3._id,
        sets: [],
        status: "pending",
      });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/admin/adm_fss_secret_2026">
            <AdminHub tournament={tournamentData} adminSecret="adm_fss_secret_2026" />
          </RouterProvider>
        </ConvexClientProvider>
      );

      // Switch to Schedule tab
      const schedTab = screen.getByText("Harmonogram & Stoły");
      fireEvent.click(schedTab);

      // Verify conflict warning banner is displayed
      expect(screen.getByText(/Wykryto kolizje w harmonogramie/)).toBeDefined();
      expect(screen.getAllByText(/rest violation/).length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Section 3: SpectatorPortal Standings Tooltips & H2H Mini-League Results
  // ==========================================================================
  describe("3. SpectatorPortal Standings Tooltips & H2H Mini-League Tiebreakers", () => {
    it("3.1 calculateStandings: generates exact mini-league explanations for multi-way ties", () => {
      const pA = "player_A";
      const pB = "player_B";
      const pC = "player_C";
      const playerIds = [pA, pB, pC];

      // Cyclic 3-way tie:
      // A beats B: 2-0 (11-5, 11-5) -> A sets: +2, B sets: -2
      // B beats C: 2-1 (11-9, 9-11, 11-9) -> B sets: +1, C sets: -1
      // C beats A: 2-1 (11-9, 9-11, 11-9) -> C sets: +1, A sets: -1
      // Overall points: all have 1 win, 1 loss.
      // Under 2_1_matrix:
      // A points: 2 (vs B) + 1 (vs C) = 3 pts
      // B points: 2 (vs C) + 0 (vs A) = 2 pts
      // C points: 2 (vs A) + 1 (vs B) = 3 pts
      // Here A and C are tied on 3 pts, B has 2 pts.
      // Between A and C: C beat A 2-1 head-to-head!
      const matches: MatchResultInput[] = [
        {
          player1Id: pA,
          player2Id: pB,
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: pB,
          player2Id: pC,
          sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: pC,
          player2Id: pA,
          sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(playerIds, matches, "2_1_matrix");
      expect(standings.length).toBe(3);

      // C beat A directly in H2H, so C is rank 1, A is rank 2, B is rank 3
      expect(standings[0].playerId).toBe(pC);
      expect(standings[0].tiebreakerExplanation).toBe(`Head-to-Head win vs ${pA}`);
      expect(standings[1].playerId).toBe(pA);
      expect(standings[2].playerId).toBe(pB);
    });

    it("3.2 calculateStandings: resolves 3-way tied mini-league via mini-league set difference", () => {
      const pA = "player_A";
      const pB = "player_B";
      const pC = "player_C";
      const playerIds = [pA, pB, pC];

      // All 3 players win 1 match 2:0 and lose 1 match 2:1 under standard_3_1_0 (each gets 3 pts):
      // A beat B 2:0 (sets: A=2, B=0)
      // B beat C 2:1 (sets: B=2, C=1)
      // C beat A 2:1 (sets: C=2, A=1)
      // Under standard_3_1_0:
      // A: 3 pts, won 1, lost 1. Mini sets won: 2+1=3, lost: 0+2=2 -> set diff: +1
      // B: 3 pts, won 1, lost 1. Mini sets won: 0+2=2, lost: 2+1=3 -> set diff: -1
      // C: 3 pts, won 1, lost 1. Mini sets won: 1+2=3, lost: 2+1=3 -> set diff: 0
      const matches: MatchResultInput[] = [
        {
          player1Id: pA,
          player2Id: pB,
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 5 }],
          status: "completed",
        },
        {
          player1Id: pB,
          player2Id: pC,
          sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
        {
          player1Id: pC,
          player2Id: pA,
          sets: [{ s1: 11, s2: 9 }, { s1: 9, s2: 11 }, { s1: 11, s2: 9 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings(playerIds, matches, "standard_3_1_0");

      // Ranked by mini-league set difference:
      // Rank 1: A (+1)
      // Rank 2: C (+0)
      // Rank 3: B (-1)
      expect(standings[0].playerId).toBe(pA);
      expect(standings[0].tiebreakerExplanation).toBe("Mini-league set diff (+1)");
      expect(standings[1].playerId).toBe(pC);
      expect(standings[1].tiebreakerExplanation).toBe("Mini-league set diff (+0)");
      expect(standings[2].playerId).toBe(pB);
      expect(standings[2].tiebreakerExplanation).toBe("Mini-league set diff (-1)");
    });

    it("3.3 SpectatorPortal UI: displays tooltip with exact tiebreaker explanation on tied standings", async () => {
      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss">
            <SpectatorPortal tournament={tournamentData} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      // Navigate to Standings tab
      const standingsTab = screen.getByText("Tabela / Wyniki");
      fireEvent.click(standingsTab);

      // All 9 players in fresh seed are tied at 0 points
      const infoButtons = screen.getAllByRole("button").filter((b) =>
        b.className.includes("text-amber-400")
      );
      expect(infoButtons.length).toBeGreaterThan(0);

      // Click the first info button to trigger tooltip
      fireEvent.click(infoButtons[0]);

      // Tooltip must display tiebreaker content and recursive rules hierarchy
      await waitFor(() => {
        expect(screen.getByText("Rozstrzygnięcie remisu")).toBeDefined();
        expect(screen.getByText(/Hierarchia reguł:/)).toBeDefined();
        expect(screen.getByText(/1\. Punkty ogólne/)).toBeDefined();
        expect(screen.getByText(/2\. Bezpośredni bilans \(H2H\)/)).toBeDefined();
        expect(screen.getByText(/3\. Wygrane mecze/)).toBeDefined();
        expect(screen.getByText(/4\. Różnica setów/)).toBeDefined();
        expect(screen.getByText(/5\. Różnica małych punktów/)).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Section 4: Walkover Scores (2:0 / 11:0 11:0) Propagation to Standings
  // ==========================================================================
  describe("4. Walkover Score Propagation to Standings", () => {
    it("4.1 setWalkover mutation: creates exact 2:0 sets (11:0, 11:0) for winner and updates match document", async () => {
      const match = mockStore.matches.get("match_fss_ga_1")!;
      const winnerId = match.player1Id;

      await mockStore.executeMutation("matches:setWalkover", {
        matchId: match._id,
        winnerPlayerId: winnerId,
        adminSecret: "adm_fss_secret_2026",
        reason: "Spóźnienie rywala",
      });

      const updated = mockStore.matches.get(match._id)!;
      expect(updated.status).toBe("completed");
      expect(updated.walkover).toBe(true);
      expect(updated.winnerId).toBe(winnerId);
      expect(updated.sets).toEqual([
        { s1: 11, s2: 0 },
        { s1: 11, s2: 0 },
      ]);
    });

    it("4.2 setWalkover when player 2 is winner: sets are 0:11, 0:11 (2:0 for P2)", async () => {
      const match = mockStore.matches.get("match_fss_ga_2")!;
      const winnerId = match.player2Id;

      await mockStore.executeMutation("matches:setWalkover", {
        matchId: match._id,
        winnerPlayerId: winnerId,
        adminSecret: "adm_fss_secret_2026",
        reason: "Kontuzja",
      });

      const updated = mockStore.matches.get(match._id)!;
      expect(updated.status).toBe("completed");
      expect(updated.walkover).toBe(true);
      expect(updated.winnerId).toBe(winnerId);
      expect(updated.sets).toEqual([
        { s1: 0, s2: 11 },
        { s1: 0, s2: 11 },
      ]);
    });

    it("4.3 calculateStandings: walkover propagates exact 2:0 (+2) sets, 22:0 (+22) small points, and 2 match points", () => {
      const p1 = "player_1";
      const p2 = "player_2";

      const walkoverMatch: MatchResultInput = {
        player1Id: p1,
        player2Id: p2,
        sets: [
          { s1: 11, s2: 0 },
          { s1: 11, s2: 0 },
        ],
        status: "completed",
        winnerId: p1,
      };

      const standings = calculateStandings([p1, p2], [walkoverMatch], "2_1_matrix");

      // Winner p1 stats
      const s1 = standings.find((s) => s.playerId === p1)!;
      expect(s1.played).toBe(1);
      expect(s1.won).toBe(1);
      expect(s1.lost).toBe(0);
      expect(s1.points).toBe(2);
      expect(s1.setsWon).toBe(2);
      expect(s1.setsLost).toBe(0);
      expect(s1.setDifference).toBe(2);
      expect(s1.pointsWon).toBe(22);
      expect(s1.pointsLost).toBe(0);
      expect(s1.pointDifference).toBe(22);

      // Loser p2 stats
      const s2 = standings.find((s) => s.playerId === p2)!;
      expect(s2.played).toBe(1);
      expect(s2.won).toBe(0);
      expect(s2.lost).toBe(1);
      expect(s2.points).toBe(0);
      expect(s2.setsWon).toBe(0);
      expect(s2.setsLost).toBe(2);
      expect(s2.setDifference).toBe(-2);
      expect(s2.pointsWon).toBe(0);
      expect(s2.pointsLost).toBe(22);
      expect(s2.pointDifference).toBe(-22);
    });

    it("4.4 SpectatorPortal UI: live standings reflect walkover sets (2:0 / +2) and points (22:0 / +22) immediately", async () => {
      const match = mockStore.matches.get("match_fss_ga_1")!;
      const winner = mockStore.players.get(match.player1Id)!;
      const loser = mockStore.players.get(match.player2Id)!;

      // Apply walkover
      await mockStore.executeMutation("matches:setWalkover", {
        matchId: match._id,
        winnerPlayerId: winner._id,
        adminSecret: "adm_fss_secret_2026",
      });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss">
            <SpectatorPortal tournament={tournamentData} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      // Switch to standings tab
      const standingsTab = screen.getByText("Tabela / Wyniki");
      fireEvent.click(standingsTab);

      // Winner should be top rank with 2 points, 2:0 (+2) sets, and 22:0 (+22) points
      await waitFor(() => {
        expect(screen.getByText("2:0")).toBeDefined();
        expect(screen.getByText("(+2)")).toBeDefined();
        expect(screen.getByText("22:0")).toBeDefined();
        expect(screen.getByText("(+22)")).toBeDefined();
        expect(screen.getByText("0:2")).toBeDefined();
        expect(screen.getByText("(-2)")).toBeDefined();
        expect(screen.getByText("0:22")).toBeDefined();
        expect(screen.getByText("(-22)")).toBeDefined();
      });
    });

    it("4.5 calculateStandings: walkover under standard_3_1_0 points rule awards 3 match points to winner", () => {
      const p1 = "p_alpha";
      const p2 = "p_beta";

      const woMatch: MatchResultInput = {
        player1Id: p1,
        player2Id: p2,
        sets: [
          { s1: 11, s2: 0 },
          { s1: 11, s2: 0 },
        ],
        status: "completed",
        winnerId: p1,
      };

      const standings = calculateStandings([p1, p2], [woMatch], "standard_3_1_0");
      expect(standings[0].playerId).toBe(p1);
      expect(standings[0].points).toBe(3); // 3 points under standard_3_1_0
      expect(standings[1].playerId).toBe(p2);
      expect(standings[1].points).toBe(0);
    });

    it("4.6 setWalkover with custom sport rules (best of 5 to 21 pkt): produces 3 sets of 21:0 (63:0 points)", async () => {
      // Modify sport rules in mockStore to 3 sets to win and 21 target points
      const rules = mockStore.sportRules.get(tournamentData.sportRulesId)!;
      rules.unitsToWinMatch = 3;
      rules.targetPointsPerUnit = 21;
      mockStore.sportRules.set(rules._id, { ...rules });

      const match = mockStore.matches.get("match_fss_ga_3")!;
      await mockStore.executeMutation("matches:setWalkover", {
        matchId: match._id,
        winnerPlayerId: match.player1Id,
        adminSecret: "adm_fss_secret_2026",
      });

      const updated = mockStore.matches.get(match._id)!;
      expect(updated.sets).toEqual([
        { s1: 21, s2: 0 },
        { s1: 21, s2: 0 },
        { s1: 21, s2: 0 },
      ]);

      const standings = calculateStandings([match.player1Id, match.player2Id], [
        {
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          sets: updated.sets,
          status: "completed",
          winnerId: match.player1Id,
        },
      ]);

      const winnerStanding = standings.find((s) => s.playerId === match.player1Id)!;
      expect(winnerStanding.setsWon).toBe(3);
      expect(winnerStanding.setsLost).toBe(0);
      expect(winnerStanding.pointsWon).toBe(63);
      expect(winnerStanding.pointDifference).toBe(63);
    });
  });

  // ==========================================================================
  // Section 5: Complex Tiebreaker & Bye Edge Cases
  // ==========================================================================
  describe("5. Edge Cases: Mini-League Point Diff & Bye Rounds", () => {
    it("5.1 calculateStandings: resolves 3-way tie via mini-league point difference when points, wins, and sets are equal", () => {
      const pA = "p_A";
      const pB = "p_B";
      const pC = "p_C";

      // Cyclic 3-way tie where each match is 2:1 and every player has:
      // 1 match won, 1 match lost
      // 3 sets won, 3 sets lost (set diff: 0)
      // Small point differences in sets separate them:
      // A vs B: A wins 2:1. Sets: 15:5 (+10), 5:15 (-10), 15:10 (+5) -> A pt diff: +5, B pt diff: -5
      // B vs C: B wins 2:1. Sets: 15:5 (+10), 5:15 (-10), 15:12 (+3) -> B pt diff: +3, C pt diff: -3
      // C vs A: C wins 2:1. Sets: 15:5 (+10), 5:15 (-10), 15:13 (+2) -> C pt diff: +2, A pt diff: -2
      // Total mini-league point differences:
      // A: +5 - 2 = +3
      // B: -5 + 3 = -2
      // C: -3 + 2 = -1
      // Mini point diff order: A (+3) > C (-1) > B (-2)
      const matches: MatchResultInput[] = [
        {
          player1Id: pA,
          player2Id: pB,
          sets: [{ s1: 15, s2: 5 }, { s1: 5, s2: 15 }, { s1: 15, s2: 10 }],
          status: "completed",
        },
        {
          player1Id: pB,
          player2Id: pC,
          sets: [{ s1: 15, s2: 5 }, { s1: 5, s2: 15 }, { s1: 15, s2: 12 }],
          status: "completed",
        },
        {
          player1Id: pC,
          player2Id: pA,
          sets: [{ s1: 15, s2: 5 }, { s1: 5, s2: 15 }, { s1: 15, s2: 13 }],
          status: "completed",
        },
      ];

      const standings = calculateStandings([pA, pB, pC], matches, "standard_3_1_0");

      expect(standings[0].playerId).toBe(pA);
      expect(standings[0].tiebreakerExplanation).toBe("Mini-league point diff (+3)");
      expect(standings[1].playerId).toBe(pC);
      expect(standings[1].tiebreakerExplanation).toBe("Mini-league point diff (-1)");
      expect(standings[2].playerId).toBe(pB);
      expect(standings[2].tiebreakerExplanation).toBe("Mini-league point diff (-2)");
    });

    it("5.2 PlayerTerminal: renders Bye round card ('Masz wolny los w tej rundzie') when active round has a bye", async () => {
      // In 9-player Berger, slot 0 (Antek Sadowski) is paired with the dummy player in round 1!
      // Thus, Antek Sadowski has a bye in round 1!
      const antek = Array.from(mockStore.players.values()).find((p) => p.name === "Antek Sadowski")!;

      const antekMatches = Array.from(mockStore.matches.values()).filter(
        (m) => m.player1Id === antek._id || m.player2Id === antek._id
      );
      // Verify Antek has no match in round 1 (he has the round 1 bye!)
      const r1Match = antekMatches.find((m) => m.roundNumber === 1);
      expect(r1Match).toBeUndefined();

      // Query player matches to verify byeRounds includes round 1
      const queryResult = mockStore.getQueryResult("matches:getMatchesForPlayer", {
        tournamentId: tournamentData._id,
        playerId: antek._id,
      });
      expect(queryResult.byeRounds).toContain(1);

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${antek.secretCode}`}>
            <PlayerTerminal tournament={tournamentData} playerSecret={antek.secretCode} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      // Verify PlayerTerminal renders the round schedule and personal info
      await waitFor(() => {
        expect(screen.getByText("Antek Sadowski")).toBeDefined();
        expect(screen.getByText("Slot #0")).toBeDefined();
        expect(screen.getByText(/Twój Terminarz Meczów/)).toBeDefined();
      });
    });

    it("5.3 PlayerTerminal: hides Next Match spotlight and displays final results when all matches are completed", async () => {
      const tomasz = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka")!;

      // Complete all of Tomasz's matches
      Array.from(mockStore.matches.values())
        .filter((m) => m.player1Id === tomasz._id || m.player2Id === tomasz._id)
        .forEach((m) => {
          m.status = "completed";
          m.winnerId = tomasz._id;
          m.sets = [{ s1: 11, s2: 8 }, { s1: 11, s2: 9 }];
          mockStore.matches.set(m._id, { ...m });
        });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${tomasz.secretCode}`}>
            <PlayerTerminal tournament={tournamentData} playerSecret={tomasz.secretCode} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      await waitFor(() => {
        // Spotlight countdown hero should NOT be present
        expect(screen.queryByText(/Czas do rozpoczęcia/)).toBeNull();
        expect(screen.queryByText(/NAJBLIŻSZY MECZ/)).toBeNull();
        // Timeline should show "Wygrana" badges for completed matches
        const winBadges = screen.getAllByText("Wygrana");
        expect(winBadges.length).toBeGreaterThan(0);
      });
    });
  });
});
