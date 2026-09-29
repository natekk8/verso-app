import { describe, it, expect } from "vitest";
import {
  generateKnockoutBracket,
  propagateKnockoutResults,
  populateGroupRankings,
  KnockoutMatch,
} from "../knockout";

describe("Single-Elimination Knockout Bracket Generator", () => {
  describe("4 Qualifiers (FSS Drabinka B Structure)", () => {
    it("generates 2 Semifinals, 1 Third-Place Match, and 1 Final", () => {
      const matches = generateKnockoutBracket(4, true);

      expect(matches).toHaveLength(4);

      const sf1 = matches.find((m) => m.id === "sf-1")!;
      const sf2 = matches.find((m) => m.id === "sf-2")!;
      const thirdPlace = matches.find((m) => m.id === "third-place")!;
      const finalMatch = matches.find((m) => m.id === "final")!;

      expect(sf1).toBeDefined();
      expect(sf2).toBeDefined();
      expect(thirdPlace).toBeDefined();
      expect(finalMatch).toBeDefined();

      // Verify Semifinal pairings (1 vs 4, 2 vs 3)
      expect(sf1.roundName).toBe("semifinals");
      expect(sf1.slot1.sourceRef).toBe("1. Grupa A");
      expect(sf1.slot2.sourceRef).toBe("4. Grupa A");

      expect(sf2.roundName).toBe("semifinals");
      expect(sf2.slot1.sourceRef).toBe("2. Grupa A");
      expect(sf2.slot2.sourceRef).toBe("3. Grupa A");

      // Verify Third Place pairing (loser SF1 vs loser SF2)
      expect(thirdPlace.roundName).toBe("third_place");
      expect(thirdPlace.slot1.sourceType).toBe("loser_of");
      expect(thirdPlace.slot1.sourceRef).toBe("sf-1");
      expect(thirdPlace.slot2.sourceType).toBe("loser_of");
      expect(thirdPlace.slot2.sourceRef).toBe("sf-2");

      // Verify Final pairing (winner SF1 vs winner SF2)
      expect(finalMatch.roundName).toBe("final");
      expect(finalMatch.slot1.sourceType).toBe("winner_of");
      expect(finalMatch.slot1.sourceRef).toBe("sf-1");
      expect(finalMatch.slot2.sourceType).toBe("winner_of");
      expect(finalMatch.slot2.sourceRef).toBe("sf-2");
    });

    it("omits third place match when includeThirdPlace is false", () => {
      const matches = generateKnockoutBracket(4, false);
      expect(matches).toHaveLength(3);
      expect(matches.some((m) => m.roundName === "third_place")).toBe(false);
    });
  });

  describe("8 Qualifiers Bracket", () => {
    it("generates 4 Quarterfinals, 2 Semifinals, 1 Third-Place Match, and 1 Final (8 total matches)", () => {
      const matches = generateKnockoutBracket(8, true);

      expect(matches).toHaveLength(8);

      const qfs = matches.filter((m) => m.roundName === "quarterfinals");
      const sfs = matches.filter((m) => m.roundName === "semifinals");
      const finals = matches.filter((m) => m.roundName === "final");
      const thirdPlace = matches.filter((m) => m.roundName === "third_place");

      expect(qfs).toHaveLength(4);
      expect(sfs).toHaveLength(2);
      expect(finals).toHaveLength(1);
      expect(thirdPlace).toHaveLength(1);

      // Verify seed distribution ensures 1 and 2 cannot meet until final
      expect(qfs[0].slot1.sourceRef).toBe("1. Grupa A");
      expect(qfs[0].slot2.sourceRef).toBe("8. Grupa A");
      expect(qfs[2].slot1.sourceRef).toBe("2. Grupa A");
      expect(qfs[2].slot2.sourceRef).toBe("7. Grupa A");
    });
  });

  describe("DAG Routing and Result Propagation", () => {
    it("populates initial group rankings into slots", () => {
      const bracket = generateKnockoutBracket(4, true);
      const rankings = [
        { rank: 1, playerId: "p-antek" },
        { rank: 2, playerId: "p-bartek" },
        { rank: 3, playerId: "p-filip" },
        { rank: 4, playerId: "p-franek" },
      ];

      const populated = populateGroupRankings(bracket, rankings);

      const sf1 = populated.find((m) => m.id === "sf-1")!;
      expect(sf1.slot1.playerId).toBe("p-antek");
      expect(sf1.slot2.playerId).toBe("p-franek");

      const sf2 = populated.find((m) => m.id === "sf-2")!;
      expect(sf2.slot1.playerId).toBe("p-bartek");
      expect(sf2.slot2.playerId).toBe("p-filip");
    });

    it("propagates semifinal winners to Final and losers to Third-Place match", () => {
      const bracket = generateKnockoutBracket(4, true);

      // Suppose SF1 is won by p-antek over p-franek
      // and SF2 is won by p-bartek over p-filip
      const results = {
        "sf-1": { winnerPlayerId: "p-antek", loserPlayerId: "p-franek" },
        "sf-2": { winnerPlayerId: "p-bartek", loserPlayerId: "p-filip" },
      };

      const propagated = propagateKnockoutResults(bracket, results);

      const finalMatch = propagated.find((m) => m.id === "final")!;
      expect(finalMatch.slot1.playerId).toBe("p-antek");
      expect(finalMatch.slot2.playerId).toBe("p-bartek");

      const thirdPlace = propagated.find((m) => m.id === "third-place")!;
      expect(thirdPlace.slot1.playerId).toBe("p-franek");
      expect(thirdPlace.slot2.playerId).toBe("p-filip");
    });
  });

  describe("Edge Cases", () => {
    it("returns empty array for qualifier count < 2", () => {
      expect(generateKnockoutBracket(1)).toEqual([]);
      expect(generateKnockoutBracket(0)).toEqual([]);
    });

    it("handles 2 qualifiers (Final only)", () => {
      const matches = generateKnockoutBracket(2, true);
      expect(matches).toHaveLength(1);
      expect(matches[0].roundName).toBe("final");
    });
  });
});
