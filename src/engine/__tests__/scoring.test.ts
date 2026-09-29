import { describe, it, expect } from "vitest";
import {
  validateMatchScore,
  generateDynamicPrompts,
  DEFAULT_SPORT_PRESETS,
  SportRulesConfig,
} from "../scoring";

describe("Dynamic Scoring Engine & Win-Condition Evaluator", () => {
  describe("Dynamic Terminology & Localized Prompts (R2)", () => {
    it("generates correct Polish prompts for standard 'Set' / 'Sety'", () => {
      const prompts = generateDynamicPrompts("Set", "Sety");
      expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Set?");
      expect(prompts.unitsToWinPrompt).toBe("Do ilu Sety gra się, żeby wygrać mecz?");
      expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Set przy stanie 1:1?");
    });

    it("generates dynamic prompts for custom unit names ('Głowa' / 'Głowy')", () => {
      const prompts = generateDynamicPrompts("Głowa", "Głowy");
      expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się Głowa?");
      expect(prompts.unitsToWinPrompt).toBe("Do ilu Głowy gra się, żeby wygrać mecz?");
      expect(prompts.deciderTiebreakPrompt).toBe("Czy jest tiebreak / decydujący Głowa przy stanie 1:1?");
    });
  });

  describe("FSS Table Tennis Rules Validation (Target 11, Decider 15 at 1:1, Win by 2)", () => {
    const tableTennisRules: SportRulesConfig = DEFAULT_SPORT_PRESETS.table_tennis;

    it("validates 2:0 clean sweep (11:9, 11:8)", () => {
      const result = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 11, s2: 8 },
        ],
        tableTennisRules
      );

      expect(result.isValid).toBe(true);
      expect(result.isMatchCompleted).toBe(true);
      expect(result.winner).toBe(1);
      expect(result.setsWonP1).toBe(2);
      expect(result.setsWonP2).toBe(0);
    });

    it("recognizes match in progress at 1:1 (11:9, 8:11)", () => {
      const result = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 8, s2: 11 },
        ],
        tableTennisRules
      );

      expect(result.isValid).toBe(true);
      expect(result.isMatchCompleted).toBe(false);
      expect(result.winner).toBeUndefined();
      expect(result.setsWonP1).toBe(1);
      expect(result.setsWonP2).toBe(1);
    });

    it("enforces 15-point target in deciding 3rd set at 1:1", () => {
      // At 1:1, 3rd set must reach 15 points (not 11)
      const prematureThirdSet = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 8, s2: 11 },
          { s1: 11, s2: 9 }, // Only 11 points in decider!
        ],
        tableTennisRules
      );

      // Incomplete decider set
      expect(prematureThirdSet.isValid).toBe(true);
      expect(prematureThirdSet.isMatchCompleted).toBe(false);

      // Decider set correctly completed to 15 points
      const completedDecider = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 8, s2: 11 },
          { s1: 15, s2: 13 },
        ],
        tableTennisRules
      );

      expect(completedDecider.isValid).toBe(true);
      expect(completedDecider.isMatchCompleted).toBe(true);
      expect(completedDecider.winner).toBe(1);
      expect(completedDecider.setsWonP1).toBe(2);
      expect(completedDecider.setsWonP2).toBe(1);
    });

    it("enforces win-by-two margin on overtime sets (e.g. 16:14 in decider, 12:10 in normal set)", () => {
      // 11:10 is not completed in win-by-2
      const uncompletedDeuce = validateMatchScore(
        [{ s1: 11, s2: 10 }],
        tableTennisRules
      );
      expect(uncompletedDeuce.isMatchCompleted).toBe(false);

      // 12:10 is completed
      const completedDeuce = validateMatchScore(
        [{ s1: 12, s2: 10 }],
        tableTennisRules
      );
      expect(completedDeuce.setsWonP1).toBe(1);

      // 16:14 in 3rd set decider (target 15) is completed
      const deciderDeuce = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 9, s2: 11 },
          { s1: 16, s2: 14 },
        ],
        tableTennisRules
      );
      expect(deciderDeuce.isValid).toBe(true);
      expect(deciderDeuce.isMatchCompleted).toBe(true);
      expect(deciderDeuce.winner).toBe(1);

      // 18:15 in decider is INVALID (diff > 2 when score > target)
      const invalidExcessiveDiff = validateMatchScore(
        [
          { s1: 11, s2: 9 },
          { s1: 9, s2: 11 },
          { s1: 18, s2: 15 },
        ],
        tableTennisRules
      );
      expect(invalidExcessiveDiff.isValid).toBe(false);
      expect(invalidExcessiveDiff.error).toContain("lead reaches 2");
    });

    it("rejects extraneous sets submitted after match completion", () => {
      // P1 already won 2:0 in the first 2 sets, 3rd set is extraneous
      const extraneous = validateMatchScore(
        [
          { s1: 11, s2: 8 },
          { s1: 11, s2: 8 },
          { s1: 11, s2: 8 },
        ],
        tableTennisRules
      );

      expect(extraneous.isValid).toBe(false);
      expect(extraneous.error).toContain("Extraneous set");
    });

    it("rejects negative scores", () => {
      const negative = validateMatchScore(
        [{ s1: -1, s2: 11 }],
        tableTennisRules
      );
      expect(negative.isValid).toBe(false);
      expect(negative.error).toContain("Negative score");
    });
  });

  describe("Rules with winByTwo: false (e.g. Football / Sudden Death)", () => {
    const suddenDeathRules: SportRulesConfig = {
      preset: "football",
      singularUnit: "Połowa",
      pluralUnit: "Połowy",
      targetPointsPerUnit: 1,
      unitsToWinMatch: 1,
      hasDeciderTiebreak: false,
      deciderThreshold: 0,
      deciderPoints: 0,
      winByTwo: false,
    };

    it("completes set exactly at target points without requiring 2-point margin", () => {
      const result = validateMatchScore([{ s1: 1, s2: 0 }], suddenDeathRules);
      expect(result.isValid).toBe(true);
      expect(result.isMatchCompleted).toBe(true);
      expect(result.winner).toBe(1);
    });

    it("rejects score exceeding target points when winByTwo is disabled", () => {
      const result = validateMatchScore([{ s1: 2, s2: 0 }], suddenDeathRules);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot exceed target");
    });
  });
});
