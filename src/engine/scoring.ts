export type SportPreset = "table_tennis" | "padel" | "football" | "esport" | "custom";

export interface SportRulesConfig {
  preset: SportPreset;
  singularUnit: string; // e.g. "Set", "Głowa", "Gem", "Połowa"
  pluralUnit: string; // e.g. "Sety", "Głowy", "Gemy", "Połowy"
  targetPointsPerUnit: number;
  unitsToWinMatch: number;
  hasDeciderTiebreak: boolean;
  deciderThreshold: number; // e.g. 1 (meaning at 1:1)
  deciderPoints: number; // e.g. 15
  winByTwo: boolean;
}

export interface ScoreValidationResult {
  isValid: boolean;
  isMatchCompleted: boolean;
  winner?: 1 | 2;
  setsWonP1: number;
  setsWonP2: number;
  error?: string;
}

export const DEFAULT_SPORT_PRESETS: Record<SportPreset, SportRulesConfig> = {
  table_tennis: {
    preset: "table_tennis",
    singularUnit: "Set",
    pluralUnit: "Sety",
    targetPointsPerUnit: 11,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: true,
    deciderThreshold: 1,
    deciderPoints: 15,
    winByTwo: true,
  },
  padel: {
    preset: "padel",
    singularUnit: "Gem",
    pluralUnit: "Gemy",
    targetPointsPerUnit: 6,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: false,
    deciderThreshold: 1,
    deciderPoints: 7,
    winByTwo: true,
  },
  football: {
    preset: "football",
    singularUnit: "Połowa",
    pluralUnit: "Połowy",
    targetPointsPerUnit: 1,
    unitsToWinMatch: 1,
    hasDeciderTiebreak: false,
    deciderThreshold: 0,
    deciderPoints: 0,
    winByTwo: false,
  },
  esport: {
    preset: "esport",
    singularUnit: "Mapa",
    pluralUnit: "Mapy",
    targetPointsPerUnit: 13,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: false,
    deciderThreshold: 1,
    deciderPoints: 13,
    winByTwo: true,
  },
  custom: {
    preset: "custom",
    singularUnit: "Set",
    pluralUnit: "Sety",
    targetPointsPerUnit: 11,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: false,
    deciderThreshold: 1,
    deciderPoints: 15,
    winByTwo: true,
  },
};

/**
 * Dynamic localized question prompts based on configured singular and plural unit names.
 */
export function generateDynamicPrompts(singularUnit: string, pluralUnit: string) {
  // Compute Polish genitive plural form for "Do ilu [PluralGenitive]" if helpful
  return {
    targetPointsPrompt: `Do ilu punktów gra się ${singularUnit}?`,
    unitsToWinPrompt: `Do ilu ${pluralUnit} gra się, żeby wygrać mecz?`,
    deciderTiebreakPrompt: `Czy jest tiebreak / decydujący ${singularUnit} przy stanie 1:1?`,
  };
}

/**
 * Validates a sequence of set scores against the tournament's sport rules.
 * 
 * Enforces:
 * 1. Non-negative point values.
 * 2. Target points per unit (or decider target when at decider threshold).
 * 3. Win-by-two margin:
 *    - If winByTwo is true: A set ends when a player reaches >= targetPoints with a lead of >= 2.
 *      If score exceeds targetPoints, lead must be exactly 2 (e.g. 12:10, 16:14). Lead > 2 when max > target is invalid.
 *    - If winByTwo is false: Set ends at exactly targetPoints.
 * 4. Extraneous sets after match completion are rejected.
 * 5. Returns completed status and winner (1 or 2).
 */
export function validateMatchScore(
  sets: { s1: number; s2: number }[],
  rules: SportRulesConfig
): ScoreValidationResult {
  let setsWonP1 = 0;
  let setsWonP2 = 0;

  if (sets.length === 0) {
    return {
      isValid: true,
      isMatchCompleted: false,
      setsWonP1: 0,
      setsWonP2: 0,
    };
  }

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];

    // Non-negative check
    if (set.s1 < 0 || set.s2 < 0) {
      return {
        isValid: false,
        isMatchCompleted: false,
        setsWonP1,
        setsWonP2,
        error: `Negative score in set ${i + 1}: ${set.s1}:${set.s2}`,
      };
    }

    // Match already completed check
    if (setsWonP1 >= rules.unitsToWinMatch || setsWonP2 >= rules.unitsToWinMatch) {
      return {
        isValid: false,
        isMatchCompleted: true,
        winner: setsWonP1 >= rules.unitsToWinMatch ? 1 : 2,
        setsWonP1,
        setsWonP2,
        error: `Extraneous set ${i + 1} submitted after match was already completed`,
      };
    }

    // Determine target points for this set
    const isDeciderSet =
      rules.hasDeciderTiebreak &&
      setsWonP1 === rules.deciderThreshold &&
      setsWonP2 === rules.deciderThreshold;

    const targetPoints = isDeciderSet ? rules.deciderPoints : rules.targetPointsPerUnit;

    const maxPts = Math.max(set.s1, set.s2);
    const minPts = Math.min(set.s1, set.s2);
    const diff = Math.abs(set.s1 - set.s2);

    let setWinner: 1 | 2 | 0 = 0;

    if (rules.winByTwo) {
      if (maxPts < targetPoints) {
        // Set in progress
        setWinner = 0;
      } else if (maxPts === targetPoints) {
        if (diff >= 2) {
          setWinner = set.s1 > set.s2 ? 1 : 2;
        } else {
          // e.g. 11:10 in set to 11 win-by-2: not completed yet
          setWinner = 0;
        }
      } else {
        // maxPts > targetPoints
        if (diff === 2) {
          setWinner = set.s1 > set.s2 ? 1 : 2;
        } else if (diff > 2) {
          return {
            isValid: false,
            isMatchCompleted: false,
            setsWonP1,
            setsWonP2,
            error: `Invalid score in set ${i + 1}: ${set.s1}:${set.s2}. In win-by-2, set terminates when lead reaches 2.`,
          };
        } else {
          // diff < 2 (e.g. 12:11, 15:15)
          setWinner = 0;
        }
      }
    } else {
      // winByTwo is false
      if (maxPts < targetPoints) {
        setWinner = 0;
      } else if (maxPts === targetPoints) {
        setWinner = set.s1 > set.s2 ? 1 : 2;
      } else {
        return {
          isValid: false,
          isMatchCompleted: false,
          setsWonP1,
          setsWonP2,
          error: `Invalid score in set ${i + 1}: ${set.s1}:${set.s2}. Score cannot exceed target ${targetPoints} when win-by-2 is disabled.`,
        };
      }
    }

    if (setWinner !== 0) {
      if (setWinner === 1) setsWonP1++;
      else setsWonP2++;
    } else {
      // Set is incomplete. If this is not the last set in the array, that is invalid
      if (i < sets.length - 1) {
        return {
          isValid: false,
          isMatchCompleted: false,
          setsWonP1,
          setsWonP2,
          error: `Set ${i + 1} (${set.s1}:${set.s2}) is incomplete but followed by another set.`,
        };
      }
    }
  }

  const isMatchCompleted =
    setsWonP1 >= rules.unitsToWinMatch || setsWonP2 >= rules.unitsToWinMatch;
  const winner = isMatchCompleted ? (setsWonP1 >= rules.unitsToWinMatch ? 1 : 2) : undefined;

  return {
    isValid: true,
    isMatchCompleted,
    winner,
    setsWonP1,
    setsWonP2,
  };
}
