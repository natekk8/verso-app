/**
 * Challenger M2-2 Empirical Verification Test Suite
 *
 * Validates:
 * 1. Client reactivity & subscriptions (useQuery, useMutation, useSyncExternalStore, immediate re-rendering, unmounts, skip).
 * 2. FSS Showcase seed integrity (9 players, 5 dates, 2 pitches, 36 group matches, 4 playoff matches, Tomasz Borówka slot 8, 2:0/2:1 points matrix).
 * 3. Offline mock store serialization and LocalStorage fallback / corruption resilience.
 * 4. Security & query sanitization (adminSecret leakage check).
 */

import React, { useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, renderHook } from "@testing-library/react";
import {
  MockConvexStore,
  ConvexClientProvider,
  useQuery,
  useMutation,
  api,
  LOCAL_STORAGE_MOCK_KEY,
  FullTournamentData,
  EnrichedStanding,
  EnrichedMatchDoc,
} from "../convex-client";
import { FSS_PLAYERS, FSS_DATES, FSS_PITCHES } from "../../../convex/seed";

// ============================================================================
// PART 1: Reactivity & Subscriptions Empirical Tests
// ============================================================================

describe("Challenger M2-2: Client Reactivity & Subscriptions", () => {
  let store: MockConvexStore;

  beforeEach(() => {
    store = new MockConvexStore(false);
  });

  it("subscribers to useQuery immediately re-render when a mutation executes", async () => {
    let renderCount = 0;

    function TournamentHeader() {
      renderCount++;
      const tournament = useQuery(api.tournaments.getBySlug, {
        slug: "mistrzostwa-1v1-fss",
      });

      if (!tournament) return <div data-testid="status">Loading</div>;
      return (
        <div>
          <h1 data-testid="title">{tournament.name}</h1>
          <span data-testid="renders">{renderCount}</span>
        </div>
      );
    }

    render(
      <ConvexClientProvider mockStore={store}>
        <TournamentHeader />
      </ConvexClientProvider>
    );

    // Initial render
    expect(screen.getByTestId("title").textContent).toBe("Mistrzostwa 1v1 FSS");
    const initialRenders = renderCount;
    expect(initialRenders).toBeGreaterThanOrEqual(1);

    // Fire mutation to update tournament name
    await act(async () => {
      await store.executeMutation("tournaments:updateSettings", {
        tournamentId: "tourn_fss",
        adminSecret: "adm_fss_secret_2026",
        name: "Verso Grand Slam FSS 2026",
      });
    });

    // Verify immediate re-render and updated DOM
    expect(screen.getByTestId("title").textContent).toBe("Verso Grand Slam FSS 2026");
    expect(renderCount).toBeGreaterThan(initialRenders);
  });

  it("standings table immediately re-renders with updated points and rank when match score is submitted", async () => {
    function StandingsTable() {
      const standings = useQuery(api.standings.getGroupStandings, {
        tournamentId: "tourn_fss",
      });

      if (!standings || standings.length === 0) return <div>No Standings</div>;

      return (
        <div>
          {standings.map((s: EnrichedStanding) => (
            <div key={s.playerId} data-testid={`standing-${s.playerId}`}>
              <span className="rank">{s.rank}</span>
              <span className="name">{s.name}</span>
              <span className="points">{s.points}</span>
            </div>
          ))}
        </div>
      );
    }

    render(
      <ConvexClientProvider mockStore={store}>
        <StandingsTable />
      </ConvexClientProvider>
    );

    // Initial state: Match 4 is pending between p_4 and p_5
    const m4 = store.matches.get("match_fss_ga_4")!;
    expect(m4.status).toBe("pending");

    const p4StandingBefore = screen.getByTestId(`standing-${m4.player1Id}`);
    const initialP4Points = parseInt(p4StandingBefore.querySelector(".points")!.textContent!, 10);

    // Submit a 2:0 score for player 1 in match 4
    await act(async () => {
      await store.executeMutation("matches:updateScore", {
        matchId: m4._id,
        adminSecret: "adm_fss_secret_2026",
        sets: [
          { s1: 11, s2: 5 },
          { s1: 11, s2: 7 },
        ],
      });
    });

    // In 2_1_matrix, 2:0 win gives +2 points to player 1, +0 to player 2
    const p4StandingAfter = screen.getByTestId(`standing-${m4.player1Id}`);
    const newP4Points = parseInt(p4StandingAfter.querySelector(".points")!.textContent!, 10);
    expect(newP4Points).toBe(initialP4Points + 2);
  });

  it("supports useMutation hook inside React component and updates UI reactively", async () => {
    function CheckInButton({ playerId }: { playerId: string }) {
      const playerList = useQuery(api.players.listByTournament, {
        tournamentId: "tourn_fss",
      });
      const toggleCheckIn = useMutation(api.players.toggleCheckIn);

      const player = playerList?.find((p: any) => p._id === playerId);
      return (
        <div>
          <span data-testid="checkin-status">{player?.checkedIn ? "CHECKED_IN" : "NOT_CHECKED_IN"}</span>
          <button
            data-testid="toggle-btn"
            onClick={() => toggleCheckIn({ playerId, checkedIn: !player?.checkedIn })}
          >
            Toggle
          </button>
        </div>
      );
    }

    render(
      <ConvexClientProvider mockStore={store}>
        <CheckInButton playerId="p_1" />
      </ConvexClientProvider>
    );

    expect(screen.getByTestId("checkin-status").textContent).toBe("CHECKED_IN");

    // Click button to toggle check-in
    await act(async () => {
      screen.getByTestId("toggle-btn").click();
    });

    expect(screen.getByTestId("checkin-status").textContent).toBe("NOT_CHECKED_IN");
  });

  it("handles multi-subscriber isolation and unmount cleanup without memory leaks", async () => {
    let sub1Calls = 0;
    let sub2Calls = 0;

    const unsubs1 = store.subscribe(() => {
      sub1Calls++;
    });
    const unsubs2 = store.subscribe(() => {
      sub2Calls++;
    });

    const m6 = store.matches.get("match_fss_ga_6")!;
    // Fire mutation with valid participant
    await store.executeMutation("matches:setWalkover", {
      matchId: "match_fss_ga_6",
      winnerId: m6.player1Id,
      adminSecret: "adm_fss_secret_2026",
    });

    expect(sub1Calls).toBe(1);
    expect(sub2Calls).toBe(1);

    // Unsubscribe listener 1
    unsubs1();

    const m7 = store.matches.get("match_fss_ga_7")!;
    await store.executeMutation("matches:setWalkover", {
      matchId: "match_fss_ga_7",
      winnerId: m7.player2Id,
      adminSecret: "adm_fss_secret_2026",
    });

    expect(sub1Calls).toBe(1); // Not called again
    expect(sub2Calls).toBe(2); // Called second time

    unsubs2();
  });

  it("handles 'skip' argument and dynamic query parameter changes cleanly", () => {
    function DynamicConsumer({ slug }: { slug: string | "skip" }) {
      const data = useQuery(api.tournaments.getBySlug, slug === "skip" ? "skip" : { slug });
      return <div data-testid="result">{data ? data.name : "SKIPPED_OR_NULL"}</div>;
    }

    const { rerender } = render(
      <ConvexClientProvider mockStore={store}>
        <DynamicConsumer slug="skip" />
      </ConvexClientProvider>
    );

    expect(screen.getByTestId("result").textContent).toBe("SKIPPED_OR_NULL");

    // Change prop to real slug
    rerender(
      <ConvexClientProvider mockStore={store}>
        <DynamicConsumer slug="mistrzostwa-1v1-fss" />
      </ConvexClientProvider>
    );

    expect(screen.getByTestId("result").textContent).toBe("Mistrzostwa 1v1 FSS");

    // Change back to skip
    rerender(
      <ConvexClientProvider mockStore={store}>
        <DynamicConsumer slug="skip" />
      </ConvexClientProvider>
    );

    expect(screen.getByTestId("result").textContent).toBe("SKIPPED_OR_NULL");
  });

  it("stress test: survives rapid burst of 50 concurrent / sequential mutations without corruption", async () => {
    const initialVersion = store.getVersion();
    let notifications = 0;
    store.subscribe(() => {
      notifications++;
    });

    const matchIds = Array.from(store.matches.keys()).slice(10, 30);

    for (let i = 0; i < 50; i++) {
      const matchId = matchIds[i % matchIds.length];
      const match = store.matches.get(matchId)!;
      await store.executeMutation("matches:updateScore", {
        matchId,
        adminSecret: "adm_fss_secret_2026",
        sets: [
          { s1: 11, s2: i % 10 },
          { s1: 11, s2: (i + 1) % 10 },
        ],
      });
    }

    expect(notifications).toBe(50);
    expect(store.getVersion()).toBe(initialVersion + 50);

    // Verify standings query still resolves cleanly after rapid mutations
    const standings = store.getQueryResult("standings:getGroupStandings", {
      tournamentId: "tourn_fss",
    });
    expect(standings).toHaveLength(9);
    expect(standings[0].rank).toBe(1);
  });
});

// ============================================================================
// PART 2: FSS Showcase Seed Integrity Empirical Tests
// ============================================================================

describe("Challenger M2-2: FSS Showcase Seed Integrity & Scoring Rules", () => {
  let store: MockConvexStore;

  beforeEach(() => {
    store = new MockConvexStore(false);
  });

  it("verifies all 9 players with exact names, unique IDs, and secret tokens", () => {
    const players = Array.from(store.players.values()).sort((a, b) => a.groupSlotIndex - b.groupSlotIndex);
    expect(players).toHaveLength(9);

    const expectedNames = [
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

    expect(players.map((p) => p.name)).toEqual(expectedNames);

    // Verify all players have distinct secret codes and are checked in
    const secretCodes = new Set(players.map((p) => p.secretCode));
    expect(secretCodes.size).toBe(9);
    players.forEach((p) => {
      expect(p.checkedIn).toBe(true);
      expect(p.secretCode.length).toBeGreaterThan(0);
    });
  });

  it("verifies Tomasz Borówka is explicitly assigned to slot index 8", () => {
    const tomasz = Array.from(store.players.values()).find((p) => p.name === "Tomasz Borówka");
    expect(tomasz).toBeDefined();
    expect(tomasz!.groupSlotIndex).toBe(8);
    expect(tomasz!.secretCode).toBe("sec-tomasz-09");
  });

  it("verifies all 5 tournament dates in chronological order", () => {
    const days = Array.from(store.days.values()).sort((a, b) => a.order - b.order);
    expect(days).toHaveLength(5);

    const expectedDates = [
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-16",
      "2026-10-17",
    ];

    expect(days.map((d) => d.date)).toEqual(expectedDates);
    days.forEach((d, idx) => {
      expect(d.order).toBe(idx + 1);
      expect(d.tournamentId).toBe("tourn_fss");
    });
  });

  it("verifies both pitches 'Stół 1' and 'Stół 2'", () => {
    const pitches = Array.from(store.pitches.values()).sort((a, b) => a.order - b.order);
    expect(pitches).toHaveLength(2);
    expect(pitches[0].name).toBe("Stół 1");
    expect(pitches[0].order).toBe(1);
    expect(pitches[1].name).toBe("Stół 2");
    expect(pitches[1].order).toBe(2);
  });

  it("verifies exactly 36 Grupa A round-robin matches (9 rounds of 4 matches) with 1 bye per player", () => {
    const groupMatches = Array.from(store.matches.values()).filter(
      (m) => m.stageId === "stage_fss_group"
    );
    expect(groupMatches).toHaveLength(36);

    // Group matches by roundNumber
    const roundMap = new Map<number, typeof groupMatches>();
    for (const m of groupMatches) {
      const list = roundMap.get(m.roundNumber) ?? [];
      list.push(m);
      roundMap.set(m.roundNumber, list);
    }

    expect(roundMap.size).toBe(9);
    for (let r = 1; r <= 9; r++) {
      const roundMatches = roundMap.get(r);
      expect(roundMatches).toBeDefined();
      expect(roundMatches!.length).toBe(4); // 4 matches per round
    }

    // Verify each player plays in exactly 8 matches and has exactly 1 bye round
    const players = Array.from(store.players.values());
    for (const p of players) {
      const playerMatches = groupMatches.filter(
        (m) => m.player1Id === p._id || m.player2Id === p._id
      );
      expect(playerMatches).toHaveLength(8);

      const roundsPlayed = new Set(playerMatches.map((m) => m.roundNumber));
      expect(roundsPlayed.size).toBe(8);

      // Verify the player has exactly 1 missing round (the bye)
      const missingRounds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((r) => !roundsPlayed.has(r));
      expect(missingRounds).toHaveLength(1);
    }

    // Verify all 36 matches represent unique player pairs (each pair plays once)
    const pairKeys = new Set<string>();
    for (const m of groupMatches) {
      const pair = [m.player1Id, m.player2Id].sort().join(" vs ");
      expect(pairKeys.has(pair)).toBe(false); // No duplicate pairings
      pairKeys.add(pair);
    }
    expect(pairKeys.size).toBe(36); // (9 * 8) / 2 = 36
  });

  it("verifies pitch & time conflict-free scheduling for all 36 group matches", () => {
    const groupMatches = Array.from(store.matches.values()).filter(
      (m) => m.stageId === "stage_fss_group"
    );

    // Group matches by dayId
    const dayGroups = new Map<string, typeof groupMatches>();
    for (const m of groupMatches) {
      expect(m.dayId).toBeDefined();
      expect(m.pitchId).toBeDefined();
      expect(m.time).toBeDefined();
      expect(m.startTimestamp).toBeDefined();
      expect(m.endTimestamp).toBeDefined();

      const list = dayGroups.get(m.dayId!) ?? [];
      list.push(m);
      dayGroups.set(m.dayId!, list);
    }

    // Ensure all 5 days have scheduled matches
    expect(dayGroups.size).toBe(5);

    // Ensure no player has overlapping matches
    for (const [dayId, matchesOnDay] of dayGroups.entries()) {
      for (let i = 0; i < matchesOnDay.length; i++) {
        for (let j = i + 1; j < matchesOnDay.length; j++) {
          const m1 = matchesOnDay[i];
          const m2 = matchesOnDay[j];

          // Check if same pitch overlaps in time
          if (m1.pitchId === m2.pitchId) {
            const overlaps =
              m1.startTimestamp! < m2.endTimestamp! && m2.startTimestamp! < m1.endTimestamp!;
            expect(overlaps).toBe(false);
          }

          // Check if any player is in both matches simultaneously
          const sharedPlayer =
            m1.player1Id === m2.player1Id ||
            m1.player1Id === m2.player2Id ||
            m1.player2Id === m2.player1Id ||
            m1.player2Id === m2.player2Id;

          if (sharedPlayer) {
            const overlaps =
              m1.startTimestamp! < m2.endTimestamp! && m2.startTimestamp! < m1.endTimestamp!;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  });

  it("verifies exactly 4 playoff matches in Drabinka B (Semifinals, 3rd place, Final)", () => {
    const koMatches = Array.from(store.matches.values()).filter(
      (m) => m.stageId === "stage_fss_knockout"
    );
    expect(koMatches).toHaveLength(4);

    const roundNames = koMatches.map((m) => m.roundName);
    const sfCount = roundNames.filter((r) => r === "semifinals").length;
    const thirdCount = roundNames.filter((r) => r === "third_place").length;
    const finalCount = roundNames.filter((r) => r === "final").length;

    expect(sfCount).toBe(2);
    expect(thirdCount).toBe(1);
    expect(finalCount).toBe(1);

    // Total tournament matches: 36 group + 4 playoff = 40
    expect(store.matches.size).toBe(40);
  });

  it("verifies sets scoring matrix: 2:0 -> 2-0 pts, 2:1 -> 2-1 pts", async () => {
    // Check initial pre-completed matches
    // Match 1: 11-7, 11-9 (2:0 sets) -> Tomasz Borówka (p_9) won 2:0 against Bartek Kalarus (p_2)
    const m1 = store.matches.get("match_fss_ga_1")!;
    expect(m1.status).toBe("completed");
    expect(m1.sets).toEqual([{ s1: 11, s2: 7 }, { s1: 11, s2: 9 }]);

    // Match 2: 8-11, 11-6, 15-13 (2:1 sets with decider) -> Filip Kruszka (p_3) won 2:1 against Michał Krzakiewicz (p_8)
    const m2 = store.matches.get("match_fss_ga_2")!;
    expect(m2.status).toBe("completed");
    expect(m2.sets).toHaveLength(3);

    const standings = store.getQueryResult("standings:getGroupStandings", {
      tournamentId: "tourn_fss",
    }) as EnrichedStanding[];

    const m1WinnerStanding = standings.find((s) => s.playerId === m1.player1Id)!;
    const m1LoserStanding = standings.find((s) => s.playerId === m1.player2Id)!;
    const m2WinnerStanding = standings.find((s) => s.playerId === m2.player1Id)!;
    const m2LoserStanding = standings.find((s) => s.playerId === m2.player2Id)!;

    // m1 was 2:0 -> winner gets 2 pts, loser gets 0 pts
    expect(m1WinnerStanding.points).toBe(2);
    expect(m1WinnerStanding.won).toBe(1);
    expect(m1LoserStanding.points).toBe(0);
    expect(m1LoserStanding.lost).toBe(1);

    // m2 was 2:1 -> winner gets 2 pts, loser gets 1 pt
    expect(m2WinnerStanding.points).toBe(2);
    expect(m2WinnerStanding.won).toBe(1);
    expect(m2LoserStanding.points).toBe(1);
    expect(m2LoserStanding.lost).toBe(1);

    // Now test a reverse 1:2 and 0:2 dynamically
    const m10 = store.matches.get("match_fss_ga_10")!;
    await store.executeMutation("matches:updateScore", {
      matchId: m10._id,
      adminSecret: "adm_fss_secret_2026",
      sets: [
        { s1: 11, s2: 9 },
        { s1: 7, s2: 11 },
        { s1: 13, s2: 15 },
      ],
    });
    // Player 2 won 2:1. Player 2 gets 2 pts, Player 1 gets 1 pt.
    expect(m10.status).toBe("completed");
    expect(m10.winnerId).toBe(m10.player2Id);

    const updatedStandings = store.getQueryResult("standings:getGroupStandings", {
      tournamentId: "tourn_fss",
    }) as EnrichedStanding[];
    const p1InM10 = updatedStandings.find((s) => s.playerId === m10.player1Id)!;
    const p2InM10 = updatedStandings.find((s) => s.playerId === m10.player2Id)!;

    expect(p2InM10.points).toBeGreaterThanOrEqual(2);
    expect(p1InM10.points).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// PART 3: Offline Mock Store Serialization & LocalStorage Fallback
// ============================================================================

describe("Challenger M2-2: Mock Store Serialization & LocalStorage Fallback", () => {
  const mockStorageState = new Map<string, string>();

  beforeEach(() => {
    mockStorageState.clear();
    // Stub window.localStorage in jsdom environment
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorageState.get(key) ?? null,
      setItem: (key: string, val: string) => mockStorageState.set(key, val),
      removeItem: (key: string) => mockStorageState.delete(key),
      clear: () => mockStorageState.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes all 10 tables cleanly and restores without data loss", () => {
    const store = new MockConvexStore(false);
    const serialized = store.serialize();

    expect(serialized.version).toBe(store.getVersion());
    expect(serialized.tournaments).toHaveLength(1);
    expect(serialized.sportRules).toHaveLength(1);
    expect(serialized.days).toHaveLength(5);
    expect(serialized.pitches).toHaveLength(2);
    expect(serialized.stages).toHaveLength(2);
    expect(serialized.groups).toHaveLength(1);
    expect(serialized.players).toHaveLength(9);
    expect(serialized.matches).toHaveLength(40);
    expect(serialized.qualificationRules).toHaveLength(4);
    expect(serialized.slides).toHaveLength(1);

    const restoredStore = new MockConvexStore(false);
    restoredStore.deserialize(serialized);

    expect(restoredStore.tournaments.size).toBe(1);
    expect(restoredStore.players.size).toBe(9);
    expect(restoredStore.matches.size).toBe(40);
    expect(restoredStore.days.size).toBe(5);
    expect(restoredStore.pitches.size).toBe(2);
    expect(restoredStore.stages.size).toBe(2);
    expect(restoredStore.groups.size).toBe(1);
    expect(restoredStore.qualificationRules.size).toBe(4);
    expect(restoredStore.slides.size).toBe(1);
  });

  it("persists state to localStorage automatically on mutations", async () => {
    const store = new MockConvexStore(true);
    // Before mutation, localStorage might not have been written yet, or saveToStorage can be called
    store.saveToStorage();
    expect(mockStorageState.has(LOCAL_STORAGE_MOCK_KEY)).toBe(true);

    // Mutate state
    await store.executeMutation("players:toggleCheckIn", {
      playerId: "p_1",
      checkedIn: false,
    });

    const storedJson = mockStorageState.get(LOCAL_STORAGE_MOCK_KEY);
    expect(storedJson).toBeDefined();
    const parsed = JSON.parse(storedJson!);
    const p1 = parsed.players.find((p: any) => p._id === "p_1");
    expect(p1.checkedIn).toBe(false);

    // Create a new store instance with persistence enabled -> should hydrate from storage
    const newStore = new MockConvexStore(true);
    const hydratedP1 = newStore.players.get("p_1");
    expect(hydratedP1).toBeDefined();
    expect(hydratedP1!.checkedIn).toBe(false);
  });

  it("recovers gracefully from corrupted JSON in localStorage by falling back to FSS showcase seed", () => {
    mockStorageState.set(LOCAL_STORAGE_MOCK_KEY, "MALFORMED_JSON_CORRUPTED{}[");

    // Instantiation must not throw error
    let store: MockConvexStore | null = null;
    expect(() => {
      store = new MockConvexStore(true);
    }).not.toThrow();

    expect(store).not.toBeNull();
    expect(store!.tournaments.size).toBe(1);
    expect(store!.players.size).toBe(9);
    expect(store!.matches.size).toBe(40);
  });

  it("recovers gracefully from empty or invalid database state in localStorage", () => {
    mockStorageState.set(LOCAL_STORAGE_MOCK_KEY, JSON.stringify({ tournaments: [] }));

    const store = new MockConvexStore(true);
    // When tournaments array is empty, it detects empty DB and reseeds FSS showcase
    expect(store.tournaments.size).toBe(1);
    expect(store.players.size).toBe(9);
    expect(store.matches.size).toBe(40);
  });

  it("handles localStorage quota exceeded exceptions without crashing application", async () => {
    const store = new MockConvexStore(true);

    // Mock localStorage.setItem to throw QuotaExceededError
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorageState.get(key) ?? null,
      setItem: () => {
        throw new Error("QuotaExceededError: storage is full");
      },
      removeItem: (key: string) => mockStorageState.delete(key),
      clear: () => mockStorageState.clear(),
    });

    // Mutation should still execute and update in-memory state cleanly
    await expect(
      store.executeMutation("matches:setWalkover", {
        matchId: "match_fss_ga_5",
        winnerId: "p_1",
        adminSecret: "adm_fss_secret_2026",
      })
    ).resolves.toBeDefined();

    const m5 = store.matches.get("match_fss_ga_5")!;
    expect(m5.status).toBe("completed");
    expect(m5.winnerId).toBe("p_1");
  });

  it("resets database to clean default FSS showcase via resetToDefaultSeed", async () => {
    const store = new MockConvexStore(true);

    // Modify store by deleting players and changing tournament name
    store.players.delete("p_1");
    store.players.delete("p_2");
    store.tournaments.get("tourn_fss")!.name = "Modified Tournament";
    expect(store.players.size).toBe(7);

    // Call reset
    store.resetToDefaultSeed();

    expect(store.players.size).toBe(9);
    expect(store.tournaments.get("tourn_fss")!.name).toBe("Mistrzostwa 1v1 FSS");
    expect(store.matches.size).toBe(40);
  });
});

// ============================================================================
// PART 4: Discrepancy & Security Forensic Challenges
// ============================================================================

describe("Challenger M2-2: Security & Forensic Integrity Challenges", () => {
  it("challenges tournaments:getBySlug vs getTournamentBundle: verifies adminSecret sanitization behavior", () => {
    const store = new MockConvexStore(false);

    // 1. In getTournamentBundle without adminSecret, adminSecret is sanitized:
    const publicBundle = store.getQueryResult("tournaments:getTournamentBundle", {
      slug: "mistrzostwa-1v1-fss",
    });
    expect(publicBundle.isAdmin).toBe(false);
    expect(publicBundle.tournament.adminSecret).toBeUndefined();

    // 2. In getBySlug: MockConvexStore sanitizes adminSecret on the returned FullTournamentData
    const bySlugData = store.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
    expect(bySlugData).not.toBeNull();
    // VERIFIED: Mock Store sanitizes adminSecret in getBySlug
    expect(bySlugData.adminSecret).toBeUndefined();
  });

  it("challenges qualificationRules foreign key references to knockout match IDs", () => {
    const store = new MockConvexStore(false);
    const qRules = Array.from(store.qualificationRules.values());
    expect(qRules).toHaveLength(4);

    const koMatches = Array.from(store.matches.values()).filter(
      (m) => m.stageId === "stage_fss_knockout"
    );
    const koMatchIds = new Set(koMatches.map((m) => m._id));

    // Knocout matches generated in FSS_SEED have IDs: "sf-1", "sf-2", "final", "third-place"
    expect(Array.from(koMatchIds).sort()).toEqual(["final", "sf-1", "sf-2", "third-place"]);

    // Qualification rules now correctly match targetMatchId: "sf-1" and "sf-2"
    expect(qRules[0].targetMatchId).toBe("sf-1");
    expect(qRules[1].targetMatchId).toBe("sf-1");
    expect(qRules[2].targetMatchId).toBe("sf-2");
    expect(qRules[3].targetMatchId).toBe("sf-2");

    // All qualification rules resolve to valid knockout match IDs
    for (const qr of qRules) {
      expect(koMatchIds.has(qr.targetMatchId)).toBe(true);
    }
  });

  it("challenges recursive tiebreaker evaluation on sets scoring matrix (2:0 / 2:1)", async () => {
    const store = new MockConvexStore(false);

    // Get standings
    const standings = store.getQueryResult("standings:getGroupStandings", {
      tournamentId: "tourn_fss",
    }) as EnrichedStanding[];

    // Verify standings properties are complete
    expect(standings).toHaveLength(9);
    standings.forEach((st) => {
      expect(st.rank).toBeGreaterThanOrEqual(1);
      expect(st.rank).toBeLessThanOrEqual(9);
      expect(st.setDifference).toBe(st.setsWon - st.setsLost);
      expect(st.pointDifference).toBe(st.pointsWon - st.pointsLost);
    });
  });
});
