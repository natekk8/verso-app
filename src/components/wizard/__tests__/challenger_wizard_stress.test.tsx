import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SportWizard } from "../SportWizard";
import { LiveCardPreview } from "../LiveCardPreview";
import { RuleParameters } from "../RuleParameters";
import { TerminologyConfig } from "../TerminologyConfig";
import { DEFAULT_WIZARD_STATE, type WizardSportState } from "../types";
import {
  generateDynamicPrompts,
  validateMatchScore,
  DEFAULT_SPORT_PRESETS,
} from "../../../engine/scoring";

describe("Challenger M3: Empirical Wizard Stress & Adversarial Test Suite", () => {
  // =========================================================================
  // 1. Extreme Unit Names & Special Characters in Polish Terminology
  // =========================================================================
  describe("1. Extreme Unit Names & Polish Terminology Robustness", () => {
    it("handles Polish diacritics and declensions in dynamic prompt generation and rendering", () => {
      const polishTestCases = [
        { singular: "Głowa", plural: "Głowy" },
        { singular: "Ćwiartka", plural: "Ćwiartki" },
        { singular: "Część", plural: "Części" },
        { singular: "Żeton", plural: "Żetony" },
        { singular: "Ścięcie", plural: "Ścięcia" },
        { singular: "Łuk", plural: "Łuki" },
        { singular: "Źdźbło", plural: "Źdźbła" },
        { singular: "Kość", plural: "Kości" },
      ];

      for (const tc of polishTestCases) {
        const prompts = generateDynamicPrompts(tc.singular, tc.plural);
        expect(prompts.targetPointsPrompt).toBe(`Do ilu punktów gra się ${tc.singular}?`);
        expect(prompts.unitsToWinPrompt).toBe(`Do ilu ${tc.plural} gra się, żeby wygrać mecz?`);
        expect(prompts.deciderTiebreakPrompt).toBe(
          `Czy jest tiebreak / decydujący ${tc.singular} przy stanie 1:1?`
        );

        // Test in LiveCardPreview
        const state: WizardSportState = {
          ...DEFAULT_WIZARD_STATE,
          singularUnit: tc.singular,
          pluralUnit: tc.plural,
        };

        const { unmount } = render(<LiveCardPreview state={state} />);
        expect(screen.getByText(new RegExp(`Rozbicie wyników \\(${tc.plural}\\):`))).toBeDefined();
        expect(screen.getByText(new RegExp(`${tc.singular} 1`))).toBeDefined();
        expect(screen.getByText(new RegExp(`Decydujący ${tc.singular}`))).toBeDefined();
        unmount();
      }
    });

    it("survives special characters, emojis, and math symbols without layout corruption", () => {
      const complexUnits = [
        { singular: "Runda #1 (Dogrywka!) & ⚔️", plural: "Rundy #1-N (Dogrywki!) & ⚔️" },
        { singular: 'Unit "Alpha" [100%]', plural: 'Units "Alpha" [100%]' },
        { singular: "Partia @ 2.0 / $50", plural: "Partie @ 2.0 / $50" },
        { singular: "Set <A> & <B>", plural: "Sety <A> & <B>" },
        { singular: "Jednostka \\ Slash /", plural: "Jednostki \\ Slash /" },
      ];

      for (const cu of complexUnits) {
        const state: WizardSportState = {
          ...DEFAULT_WIZARD_STATE,
          singularUnit: cu.singular,
          pluralUnit: cu.plural,
        };

        const { unmount } = render(<LiveCardPreview state={state} />);
        expect(screen.getByText(new RegExp(`Rozbicie wyników`))).toBeDefined();
        unmount();
      }
    });

    it("resists HTML/XSS injection attempts by rendering them strictly as escaped text", () => {
      const maliciousUnits = [
        { singular: '<script>alert("xss")</script>', plural: '<img src=x onerror=alert(1)>' },
        { singular: '<b onmouseover="alert(1)">Set</b>', plural: '<iframe src="javascript:alert(1)">' },
      ];

      for (const mu of maliciousUnits) {
        const prompts = generateDynamicPrompts(mu.singular, mu.plural);
        expect(prompts.targetPointsPrompt).toContain(mu.singular);

        const state: WizardSportState = {
          ...DEFAULT_WIZARD_STATE,
          singularUnit: mu.singular,
          pluralUnit: mu.plural,
        };

        const { container, unmount } = render(<LiveCardPreview state={state} />);
        // Script tags should NOT be parsed as HTML executable script elements
        const scripts = container.querySelectorAll("script");
        expect(scripts.length).toBe(0);
        const iframes = container.querySelectorAll("iframe");
        expect(iframes.length).toBe(0);
        unmount();
      }
    });

    it("handles extreme string lengths (150+ chars) gracefully", () => {
      const superLongSingular = "BardzoDługaNazwaJednostkiMeczowejKtóraMogłabyPrzełamaćUkładKartyMeczowejLubSpowodowaćOverflow1234567890";
      const superLongPlural = "BardzoDługieNazwyJednostekMeczowychKtóreMogłybyPrzełamaćUkładKartyMeczowejLubSpowodowaćOverflow1234567890";

      const state: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        singularUnit: superLongSingular,
        pluralUnit: superLongPlural,
      };

      const { unmount } = render(<LiveCardPreview state={state} />);
      expect(screen.getByText(new RegExp(`Rozbicie wyników`))).toBeDefined();
      unmount();
    });

    it("handles empty and whitespace-only unit strings without crashing", () => {
      const state: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        singularUnit: "",
        pluralUnit: "",
      };

      const prompts = generateDynamicPrompts("", "");
      expect(prompts.targetPointsPrompt).toBe("Do ilu punktów gra się ?");
      expect(prompts.unitsToWinPrompt).toBe("Do ilu  gra się, żeby wygrać mecz?");

      const { unmount } = render(<LiveCardPreview state={state} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      unmount();
    });
  });

  // =========================================================================
  // 2. Boundary Scoring Configurations
  // =========================================================================
  describe("2. Boundary Scoring Configurations", () => {
    it("handles targetPointsPerUnit = 0 and reflects validation error in LiveCardPreview", () => {
      // In LiveCardPreview: target = Math.max(1, state.targetPointsPerUnit) = 1.
      // But validateMatchScore uses rules.targetPointsPerUnit = 0.
      // With winByTwo = true: score 1:0 has maxPts (1) > targetPoints (0) with diff = 1 < 2,
      // which is incomplete, so isMatchCompleted = false, and Set 1 is followed by Set 2.
      const stateZero: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        targetPointsPerUnit: 0,
      };

      const { unmount } = render(<LiveCardPreview state={stateZero} />);
      // Should show error badge with the exact engine message
      expect(screen.getByText(/Błąd reguł: Set 1 \(1:0\) is incomplete but followed by another set\./)).toBeDefined();
      unmount();

      // Test directly in validateMatchScore
      const engineRes = validateMatchScore([{ s1: 1, s2: 0 }, { s1: 0, s2: 1 }], {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        targetPointsPerUnit: 0,
      });
      expect(engineRes.isValid).toBe(false);
      expect(engineRes.error).toContain("is incomplete but followed by another set");
    });

    it("handles targetPointsPerUnit = 1 with winByTwo = true vs winByTwo = false", () => {
      // With winByTwo = true, target = 1: score 1:0 is incomplete because lead is only 1
      const stateWinByTwoTrue: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        targetPointsPerUnit: 1,
        unitsToWinMatch: 1,
        winByTwo: true,
      };

      const { unmount: u1 } = render(<LiveCardPreview state={stateWinByTwoTrue} />);
      // Incomplete match with no following set -> shows "Niespełnione warunki" fallback
      expect(screen.getByText(/Błąd reguł: Niespełnione warunki/)).toBeDefined();
      u1();

      // With winByTwo = false, target = 1 (Football style): score 1:0 is completed
      const stateWinByTwoFalse: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        preset: "football",
        singularUnit: "Połowa",
        pluralUnit: "Połowy",
        targetPointsPerUnit: 1,
        unitsToWinMatch: 1,
        hasDeciderTiebreak: false,
        winByTwo: false,
      };

      const { unmount: u2 } = render(<LiveCardPreview state={stateWinByTwoFalse} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      u2();
    });

    it("handles extreme target points (e.g. 10000) correctly", () => {
      const stateExtremeTarget: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        targetPointsPerUnit: 10000,
        hasDeciderTiebreak: false,
      };

      const { unmount } = render(<LiveCardPreview state={stateExtremeTarget} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      // Should show 10000 : 9998
      expect(screen.getAllByText(/10000 : 9998/).length).toBeGreaterThan(0);
      unmount();
    });

    it("handles boundary decider points (0, 1, 999)", () => {
      // Decider points = 0 with winByTwo: incomplete decider set
      const stateDeciderZero: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        hasDeciderTiebreak: true,
        unitsToWinMatch: 2,
        deciderPoints: 0,
        winByTwo: true,
      };

      const { unmount: u1 } = render(<LiveCardPreview state={stateDeciderZero} />);
      expect(screen.getByText(/Błąd reguł: Niespełnione warunki/)).toBeDefined();
      u1();

      // Decider points = 1 with winByTwo: incomplete decider set
      const stateDeciderOne: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        hasDeciderTiebreak: true,
        unitsToWinMatch: 2,
        deciderPoints: 1,
        winByTwo: true,
      };

      const { unmount: u2 } = render(<LiveCardPreview state={stateDeciderOne} />);
      expect(screen.getByText(/Błąd reguł: Niespełnione warunki/)).toBeDefined();
      u2();

      // Decider points = 999 with winByTwo: valid
      const stateDecider999: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        hasDeciderTiebreak: true,
        unitsToWinMatch: 2,
        deciderPoints: 999,
        winByTwo: true,
      };

      const { unmount: u3 } = render(<LiveCardPreview state={stateDecider999} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      expect(screen.getByText(/999 : 997/)).toBeDefined();
      u3();
    });

    it("handles various unitsToWinMatch counts (1, 3, 5, 20)", () => {
      // 1 unit to win (Bo1)
      const stateBo1: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        unitsToWinMatch: 1,
      };
      const { unmount: u1 } = render(<LiveCardPreview state={stateBo1} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      expect(screen.getByText(/Set 1/)).toBeDefined();
      expect(screen.queryByText(/Set 2/)).toBeNull();
      u1();

      // 3 units to win (Bo5)
      const stateBo5: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        unitsToWinMatch: 3,
        hasDeciderTiebreak: false,
      };
      const { unmount: u2 } = render(<LiveCardPreview state={stateBo5} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      expect(screen.getByText(/Set 1/)).toBeDefined();
      expect(screen.getByText(/Set 2/)).toBeDefined();
      expect(screen.getByText(/Set 3/)).toBeDefined();
      u2();

      // 5 units to win (Bo9)
      const stateBo9: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        unitsToWinMatch: 5,
        hasDeciderTiebreak: false,
      };
      const { unmount: u3 } = render(<LiveCardPreview state={stateBo9} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      expect(screen.getByText(/Set 5/)).toBeDefined();
      u3();

      // 20 units to win (Extreme)
      const stateBo39: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        unitsToWinMatch: 20,
        hasDeciderTiebreak: false,
      };
      const { unmount: u4 } = render(<LiveCardPreview state={stateBo39} />);
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      expect(screen.getByText(/Set 20/)).toBeDefined();
      u4();
    });

    it("clamps negative numbers and NaN to minimum 1 in RuleParameters", () => {
      const handleChange = vi.fn();
      render(<RuleParameters state={DEFAULT_WIZARD_STATE} onChange={handleChange} />);

      const targetInput = screen.getByLabelText("Do ilu punktów gra się Set?");

      // Enter negative number
      fireEvent.change(targetInput, { target: { value: "-5" } });
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });

      // Enter 0
      fireEvent.change(targetInput, { target: { value: "0" } });
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });

      // Enter empty string (which parses to NaN)
      fireEvent.change(targetInput, { target: { value: "" } });
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });
    });
  });

  // =========================================================================
  // 3. Decider Tiebreak Toggle Transitions and Win-by-2 Margin Enforcement
  // =========================================================================
  describe("3. Decider Tiebreak Transitions & Win-By-2 Margin Enforcement", () => {
    it("dynamically shows and hides decider points input and toggles tiebreak in state", () => {
      const handleChange = vi.fn();
      render(<SportWizard onChange={handleChange} />);

      // Initially, Table Tennis has decider tiebreak = true
      expect(screen.getByLabelText(/Punkty w decydującym Set/)).toBeDefined();
      expect(screen.getByText(/Decydujący Set/)).toBeDefined();

      // Toggle decider off
      const switches = screen.getAllByRole("switch");
      const deciderSwitch = switches[0];
      fireEvent.click(deciderSwitch);

      // Decider input must disappear
      expect(screen.queryByLabelText(/Punkty w decydującym Set/)).toBeNull();
      // Preview should now show 2 sets only, without Decydujący Set
      expect(screen.queryByText(/Decydujący Set/)).toBeNull();
      expect(screen.getByText(/Set 2/)).toBeDefined();

      // Check state change
      const stateNoDecider = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(stateNoDecider.hasDeciderTiebreak).toBe(false);

      // Toggle decider back on
      fireEvent.click(deciderSwitch);
      expect(screen.getByLabelText(/Punkty w decydującym Set/)).toBeDefined();
      expect(screen.getByText(/Decydujący Set/)).toBeDefined();
      const stateWithDecider = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(stateWithDecider.hasDeciderTiebreak).toBe(true);
      expect(stateWithDecider.deciderPoints).toBe(15);
    });

    it("enforces win-by-2 margin in LiveCardPreview and validateMatchScore", () => {
      // 1. With winByTwo = true:
      // Mock set generates target (11) and target - diff (9) -> margin is 2.
      const stateWinByTwo: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        targetPointsPerUnit: 11,
        winByTwo: true,
        hasDeciderTiebreak: false,
      };

      const { unmount: u1 } = render(<LiveCardPreview state={stateWinByTwo} />);
      expect(screen.getByText(/11 : 9/)).toBeDefined();
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      u1();

      // 2. With winByTwo = false:
      // Mock set generates target (11) and target - diff (10) -> margin is 1.
      const stateNoWinByTwo: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        targetPointsPerUnit: 11,
        winByTwo: false,
        hasDeciderTiebreak: false,
      };

      const { unmount: u2 } = render(<LiveCardPreview state={stateNoWinByTwo} />);
      expect(screen.getByText(/11 : 10/)).toBeDefined();
      expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
      u2();

      // 3. Directly adversarial tests on validateMatchScore:
      // A set ending 11:10 with winByTwo = true is incomplete
      const resIncomplete = validateMatchScore([{ s1: 11, s2: 10 }], {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        winByTwo: true,
      });
      expect(resIncomplete.isValid).toBe(true);
      expect(resIncomplete.isMatchCompleted).toBe(false);

      // A set ending 13:10 with winByTwo = true is invalid (lead cannot exceed 2 above target)
      const resInvalidLead = validateMatchScore([{ s1: 13, s2: 10 }], {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        winByTwo: true,
      });
      expect(resInvalidLead.isValid).toBe(false);
      expect(resInvalidLead.error).toContain("In win-by-2, set terminates when lead reaches 2");

      // A set ending 12:10 with winByTwo = true is valid and complete
      const resValidOvertime = validateMatchScore([{ s1: 12, s2: 10 }, { s1: 12, s2: 10 }], {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        unitsToWinMatch: 2,
        winByTwo: true,
        hasDeciderTiebreak: false,
      });
      expect(resValidOvertime.isValid).toBe(true);
      expect(resValidOvertime.isMatchCompleted).toBe(true);
      expect(resValidOvertime.winner).toBe(1);

      // A set ending 12:10 with winByTwo = false is invalid (score cannot exceed target)
      const resExceedNoMargin = validateMatchScore([{ s1: 12, s2: 10 }], {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        winByTwo: false,
      });
      expect(resExceedNoMargin.isValid).toBe(false);
      expect(resExceedNoMargin.error).toContain("Score cannot exceed target 11 when win-by-2 is disabled");
    });
  });

  // =========================================================================
  // 4. LiveCardPreview Integration with validateMatchScore & Standings Points
  // =========================================================================
  describe("4. LiveCardPreview Integration & Standings Points Evaluation", () => {
    it("correctly awards 2:1 and 2:0 points under 2_1_matrix", () => {
      // 2:1 match (hasDeciderTiebreak = true, unitsToWinMatch = 2)
      const state21: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        pointsRule: "2_1_matrix",
        hasDeciderTiebreak: true,
        unitsToWinMatch: 2,
      };

      const { unmount: u1 } = render(<LiveCardPreview state={state21} />);
      expect(screen.getByText(/Antek:/)).toBeDefined();
      expect(screen.getByText(/\+2 pkt/)).toBeDefined();
      expect(screen.getByText(/Tomasz:/)).toBeDefined();
      expect(screen.getByText(/\+1 pkt/)).toBeDefined();
      expect(screen.getByText(/Matrix 2:1 -> 2 pkt dla wygranego, 1 pkt dla przegranego/)).toBeDefined();
      u1();

      // 2:0 match (hasDeciderTiebreak = false, unitsToWinMatch = 2)
      const state20: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        pointsRule: "2_1_matrix",
        hasDeciderTiebreak: false,
        unitsToWinMatch: 2,
      };

      const { unmount: u2 } = render(<LiveCardPreview state={state20} />);
      expect(screen.getByText(/Antek:/)).toBeDefined();
      expect(screen.getByText(/\+2 pkt/)).toBeDefined();
      expect(screen.getByText(/Tomasz:/)).toBeDefined();
      expect(screen.getByText(/\+0 pkt/)).toBeDefined();
      expect(screen.getByText(/Matrix 2:0 -> 2 pkt dla wygranego, 0 pkt dla przegranego/)).toBeDefined();
      u2();
    });

    it("correctly awards 3:0 points under standard_3_1_0 rule", () => {
      const state310: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        pointsRule: "standard_3_1_0",
        hasDeciderTiebreak: true,
        unitsToWinMatch: 2,
      };

      const { unmount } = render(<LiveCardPreview state={state310} />);
      expect(screen.getByText(/Antek:/)).toBeDefined();
      expect(screen.getByText(/\+3 pkt/)).toBeDefined();
      expect(screen.getByText(/Tomasz:/)).toBeDefined();
      expect(screen.getByText(/\+0 pkt/)).toBeDefined();
      expect(screen.getByText(/Standard 3-1-0 -> 3 pkt dla wygranego, 0 pkt dla przegranego/)).toBeDefined();
      unmount();
    });

    it("accurately switches player score submission lock indicators", () => {
      // When enabled
      const stateAllowed: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        allowPlayerScoreSubmission: true,
      };
      const { unmount: u1 } = render(<LiveCardPreview state={stateAllowed} />);
      expect(screen.getByText(/Wprowadzanie graczy: Aktywne/)).toBeDefined();
      u1();

      // When locked / disabled
      const stateLocked: WizardSportState = {
        ...DEFAULT_WIZARD_STATE,
        allowPlayerScoreSubmission: false,
      };
      const { unmount: u2 } = render(<LiveCardPreview state={stateLocked} />);
      expect(screen.getByText(/Wprowadzanie graczy: Blokada/)).toBeDefined();
      u2();
    });
  });

  // =========================================================================
  // 5. Full End-to-End Wizard Interaction & State Preservation
  // =========================================================================
  describe("5. End-to-End Wizard Mutation & Stress Flow", () => {
    it("preserves state consistency across multiple rapid preset shifts and adjustments", () => {
      const handleChange = vi.fn();
      render(<SportWizard onChange={handleChange} />);

      // Preset shifts: Table tennis -> Esports -> Football -> Padel -> Custom
      const esportBtn = screen.getByText("E-sport").closest("button")!;
      fireEvent.click(esportBtn);

      let lastState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(lastState.preset).toBe("esport");
      expect(lastState.singularUnit).toBe("Mapa");
      expect(lastState.targetPointsPerUnit).toBe(13);

      const footballBtn = screen.getByText("Piłka nożna").closest("button")!;
      fireEvent.click(footballBtn);

      lastState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(lastState.preset).toBe("football");
      expect(lastState.singularUnit).toBe("Połowa");
      expect(lastState.targetPointsPerUnit).toBe(1);
      expect(lastState.winByTwo).toBe(false);

      // Now customize units via input
      const singularInput = screen.getByLabelText(/Liczba pojedyncza/);
      fireEvent.change(singularInput, { target: { value: "Kwarta" } });
      const pluralInput = screen.getByLabelText(/Liczba mnoga/);
      fireEvent.change(pluralInput, { target: { value: "Kwarty" } });

      lastState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(lastState.singularUnit).toBe("Kwarta");
      expect(lastState.pluralUnit).toBe("Kwarty");

      // Reset to defaults
      const resetBtn = screen.getByText("Domyślne FSS").closest("button")!;
      fireEvent.click(resetBtn);

      lastState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(lastState.preset).toBe("table_tennis");
      expect(lastState.singularUnit).toBe("Set");
      expect(lastState.pluralUnit).toBe("Sety");
      expect(lastState.targetPointsPerUnit).toBe(11);
      expect(lastState.unitsToWinMatch).toBe(2);
      expect(lastState.hasDeciderTiebreak).toBe(true);
      expect(lastState.deciderPoints).toBe(15);
      expect(lastState.pointsRule).toBe("2_1_matrix");
    });

    it("validates that onSave triggers with completely serialized payload matching engine requirements", async () => {
      const handleSave = vi.fn();
      render(<SportWizard onSave={handleSave} />);

      const saveBtn = screen.getByRole("button", { name: /Zatwierdź & Kontynuuj/ });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
      const savedPayload: WizardSportState = handleSave.mock.calls[0][0];

      // Verify payload can directly drive validateMatchScore
      const simulatedValidation = validateMatchScore(
        [
          { s1: savedPayload.targetPointsPerUnit, s2: savedPayload.targetPointsPerUnit - 2 },
          { s1: 0, s2: savedPayload.targetPointsPerUnit },
          { s1: savedPayload.deciderPoints, s2: savedPayload.deciderPoints - 2 },
        ],
        {
          preset: savedPayload.preset,
          singularUnit: savedPayload.singularUnit,
          pluralUnit: savedPayload.pluralUnit,
          targetPointsPerUnit: savedPayload.targetPointsPerUnit,
          unitsToWinMatch: savedPayload.unitsToWinMatch,
          hasDeciderTiebreak: savedPayload.hasDeciderTiebreak,
          deciderThreshold: savedPayload.deciderThreshold,
          deciderPoints: savedPayload.deciderPoints,
          winByTwo: savedPayload.winByTwo,
        }
      );

      expect(simulatedValidation.isValid).toBe(true);
      expect(simulatedValidation.isMatchCompleted).toBe(true);
      expect(simulatedValidation.winner).toBe(1);
    });
  });
});
