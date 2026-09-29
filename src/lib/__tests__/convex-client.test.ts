import { describe, it, expect } from "vitest";
import {
  MockConvexStore,
  api,
  resolveFunctionName,
  FullTournamentData,
  EnrichedStanding,
} from "../convex-client";

describe("Convex Client & Offline Mock Store", () => {
  it("initializes default FSS showcase seed with 9 players, 5 dates, 2 pitches, and 40 matches", () => {
    const store = new MockConvexStore(false);
    expect(store.tournaments.size).toBe(1);
    expect(store.players.size).toBe(9);
    expect(store.days.size).toBe(5);
    expect(store.pitches.size).toBe(2);
    expect(store.stages.size).toBe(2);
    expect(store.groups.size).toBe(1);
    expect(store.matches.size).toBe(40);
    expect(store.slides.size).toBe(1);

    const tomasz = Array.from(store.players.values()).find((p) => p.name === "Tomasz Borówka");
    expect(tomasz).toBeDefined();
    expect(tomasz!.groupSlotIndex).toBe(8);
    expect(tomasz!.secretCode).toBe("sec-tomasz-09");
  });

  it("handles tournaments:getBySlug and tournaments:getTournamentBundle queries", () => {
    const store = new MockConvexStore(false);
    const bundle = store.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    }) as FullTournamentData;

    expect(bundle).not.toBeNull();
    expect(bundle.slug).toBe("mistrzostwa-1v1-fss");
    expect(bundle.sportRules.preset).toBe("table_tennis");
    expect(bundle.sportRules.singularUnit).toBe("Set");
    expect(bundle.sportRules.pluralUnit).toBe("Sety");
    expect(bundle.days).toHaveLength(5);
    expect(bundle.pitches).toHaveLength(2);
    expect(bundle.stages).toHaveLength(2);
    expect(bundle.groups).toHaveLength(1);
    expect(bundle.slides?.rotationIntervalSeconds).toBe(10);

    const adminBundle = store.getQueryResult("tournaments:getTournamentBundle", {
      slug: "mistrzostwa-1v1-fss",
      adminSecret: "adm_fss_secret_2026",
    });
    expect(adminBundle.isAdmin).toBe(true);
    expect(adminBundle.tournament.adminSecret).toBe("adm_fss_secret_2026");
  });

  it("verifies admin secret with tournaments:verifyAdminSecret", () => {
    const store = new MockConvexStore(false);
    const validCheck = store.getQueryResult("tournaments:verifyAdminSecret", {
      slug: "mistrzostwa-1v1-fss",
      adminSecret: "adm_fss_secret_2026",
    });
    expect(validCheck.isValid).toBe(true);

    const invalidCheck = store.getQueryResult("tournaments:verifyAdminSecret", {
      slug: "mistrzostwa-1v1-fss",
      adminSecret: "wrong_secret",
    });
    expect(invalidCheck.isValid).toBe(false);
  });

  it("calculates standings via standings:getGroupStandings with 2_1_matrix", () => {
    const store = new MockConvexStore(false);
    const standings = store.getQueryResult("standings:getGroupStandings", {
      tournamentId: "tourn_fss",
    }) as EnrichedStanding[];

    expect(standings).toHaveLength(9);
    expect(standings[0].player).toBeDefined();
    expect(standings[0].rank).toBe(1);
    standings.forEach((st) => {
      expect(st.played).toBeGreaterThanOrEqual(0);
      expect(st.points).toBeGreaterThanOrEqual(0);
    });
  });

  it("notifies subscribers and increments version on mutations", async () => {
    const store = new MockConvexStore(false);
    let subscriberCalls = 0;
    const unsubscribe = store.subscribe(() => {
      subscriberCalls++;
    });

    const initialVersion = store.getVersion();
    await store.executeMutation("matches:updateScore", {
      matchId: "match_fss_ga_4",
      adminSecret: "adm_fss_secret_2026",
      sets: [
        { s1: 11, s2: 7 },
        { s1: 11, s2: 8 },
      ],
    });

    expect(subscriberCalls).toBe(1);
    expect(store.getVersion()).toBe(initialVersion + 1);

    const m4 = store.matches.get("match_fss_ga_4")!;
    expect(m4.status).toBe("completed");
    expect(m4.winnerId).toBe(m4.player1Id);

    unsubscribe();
    await store.executeMutation("players:toggleCheckIn", {
      playerId: "p_1",
      checkedIn: false,
    });
    expect(subscriberCalls).toBe(1);
  });

  it("enforces permission gates in matches:submitPlayerScore", async () => {
    const store = new MockConvexStore(false);
    const m5 = store.matches.get("match_fss_ga_5")!;
    expect(m5.status).toBe("pending");

    // 1. Invalid player secret
    await expect(
      store.executeMutation("matches:submitPlayerScore", {
        matchId: "match_fss_ga_5",
        playerSecret: "sec-unauthorized",
        sets: [{ s1: 11, s2: 4 }],
      })
    ).rejects.toThrow("Invalid player secret code");

    // 2. Valid submission by participant
    const p1 = store.players.get(m5.player1Id)!;
    await store.executeMutation("matches:submitPlayerScore", {
      matchId: "match_fss_ga_5",
      playerSecret: p1.secretCode,
      sets: [
        { s1: 11, s2: 6 },
        { s1: 11, s2: 8 },
      ],
    });
    expect(m5.status).toBe("completed");

    // 3. Reject modification of completed match by player
    await expect(
      store.executeMutation("matches:submitPlayerScore", {
        matchId: "match_fss_ga_5",
        playerSecret: p1.secretCode,
        sets: [{ s1: 11, s2: 9 }],
      })
    ).rejects.toThrow("Player cannot overwrite completed/verified match score");
  });

  it("handles walkover with matches:setWalkover", async () => {
    const store = new MockConvexStore(false);
    const m6 = store.matches.get("match_fss_ga_6")!;

    await store.executeMutation("matches:setWalkover", {
      matchId: "match_fss_ga_6",
      winnerId: m6.player2Id,
      adminSecret: "adm_fss_secret_2026",
    });

    expect(m6.status).toBe("completed");
    expect(m6.winnerId).toBe(m6.player2Id);
    expect(m6.walkover).toBe(true);
    expect(m6.sets).toEqual([
      { s1: 0, s2: 11 },
      { s1: 0, s2: 11 },
    ]);
  });

  it("serializes and deserializes state accurately", () => {
    const store = new MockConvexStore(false);
    const serialized = store.serialize();

    expect(serialized.tournaments).toHaveLength(1);
    expect(serialized.players).toHaveLength(9);
    expect(serialized.matches).toHaveLength(40);

    const restored = new MockConvexStore(false);
    restored.tournaments.clear();
    restored.players.clear();
    restored.matches.clear();
    expect(restored.tournaments.size).toBe(0);

    restored.deserialize(serialized);
    expect(restored.tournaments.size).toBe(1);
    expect(restored.players.size).toBe(9);
    expect(restored.matches.size).toBe(40);
  });

  it("resolves function names from api proxy and string references", () => {
    expect(resolveFunctionName(api.tournaments.getBySlug)).toBe("tournaments:getBySlug");
    expect(resolveFunctionName(api.matches.updateScore)).toBe("matches:updateScore");
    expect(resolveFunctionName(api.standings.getGroupStandings)).toBe("standings:getGroupStandings");
    expect(resolveFunctionName("custom:query")).toBe("custom:query");
  });

  it("provides personalized player match schedule with matches:getMatchesForPlayer", () => {
    const store = new MockConvexStore(false);
    const p1 = Array.from(store.players.values())[0];

    const result = store.getQueryResult("matches:getMatchesForPlayer", {
      tournamentId: "tourn_fss",
      playerId: p1._id,
    });

    expect(result).toBeDefined();
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.upcomingMatch).toBeDefined();
    expect(Array.isArray(result.byeRounds)).toBe(true);
    // Since N=9, there are 9 rounds and each player plays in 8 rounds, with exactly 1 bye round
    expect(result.byeRounds).toHaveLength(1);
  });

  it("returns presenter data with slides:getPresenterData", () => {
    const store = new MockConvexStore(false);
    const presenter = store.getQueryResult("slides:getPresenterData", {
      slug: "mistrzostwa-1v1-fss",
    });

    expect(presenter).not.toBeNull();
    expect(presenter.tournament.slug).toBe("mistrzostwa-1v1-fss");
    expect(presenter.slideConfig).toBeDefined();
    expect(Array.isArray(presenter.inProgressMatches)).toBe(true);
    expect(Array.isArray(presenter.upcomingMatches)).toBe(true);
    expect(Array.isArray(presenter.standings)).toBe(true);
  });

  it("generates knockout stage with matches:generateKnockoutStage", async () => {
    const store = new MockConvexStore(false);
    const initialStages = store.stages.size;
    const initialMatches = store.matches.size;

    const res = await store.executeMutation("matches:generateKnockoutStage", {
      tournamentId: "tourn_fss",
      adminSecret: "adm_fss_secret_2026",
      stageName: "Puchar Pocieszenia",
      qualifierCount: 4,
      includeThirdPlace: true,
    });

    expect(res.stageId).toBeDefined();
    expect(res.matchCount).toBe(4);
    expect(store.stages.size).toBe(initialStages + 1);
    expect(store.matches.size).toBe(initialMatches + 4);
  });
});
