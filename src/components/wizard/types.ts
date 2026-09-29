import type { SportPreset } from "../../engine/scoring";

export interface WizardSportState {
  preset: SportPreset;
  singularUnit: string;
  pluralUnit: string;
  targetPointsPerUnit: number;
  unitsToWinMatch: number;
  hasDeciderTiebreak: boolean;
  deciderThreshold: number;
  deciderPoints: number;
  winByTwo: boolean;
  pointsRule: "2_1_matrix" | "standard_3_1_0";
  allowPlayerScoreSubmission: boolean;
}

export const DEFAULT_WIZARD_STATE: WizardSportState = {
  preset: "table_tennis",
  singularUnit: "Set",
  pluralUnit: "Sety",
  targetPointsPerUnit: 11,
  unitsToWinMatch: 2,
  hasDeciderTiebreak: true,
  deciderThreshold: 1,
  deciderPoints: 15,
  winByTwo: true,
  pointsRule: "2_1_matrix",
  allowPlayerScoreSubmission: true,
};
