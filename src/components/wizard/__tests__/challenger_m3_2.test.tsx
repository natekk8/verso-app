import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SportWizard } from "../SportWizard";
import { PresetSelector, PRESET_OPTIONS } from "../PresetSelector";
import { RuleParameters } from "../RuleParameters";
import { LiveCardPreview } from "../LiveCardPreview";
import { DEFAULT_WIZARD_STATE, type WizardSportState } from "../types";
import {
  DEFAULT_SPORT_PRESETS,
  SportPreset,
  generateDynamicPrompts,
  validateMatchScore,
} from "../../../engine/scoring";
import {
  calculateStandings,
  type MatchResultInput,
  type PointsRule,
} from "../../../engine/standings";
import { MockConvexStore } from "../../../lib/convex-client";

describe("Challenger M3-2 Empirical Adversarial Test Suite", () => {
  // ==========================================================================
  // SUITE 1: Full-Matrix Preset Transitions & Dirty State Inoculation
  // ==========================================================================
  describe("1. Preset Transitions & State Sanitization", () => {
    const allPresets: SportPreset[] = [
      "table_tennis",
      "padel",
      "football",
      "esport",
      "custom",
    ];

    it("verifies all 5 presets have complete and accurate default specifications", () => {
      expect(PRESET_OPTIONS).toHaveLength(5);

      for (const preset of PRESET_OPTIONS) {
        const engineDefault = DEFAULT_SPORT_PRESETS[preset.id];
        expect(engineDefault).toBeDefined();

        expect(preset.defaults.singularUnit).toBe(engineDefault.singularUnit);
        expect(preset.defaults.pluralUnit).toBe(engineDefault.pluralUnit);
        expect(preset.defaults.targetPointsPerUnit).toBe(engineDefault.targetPointsPerUnit);
        expect(preset.defaults.unitsToWinMatch).toBe(engineDefault.unitsToWinMatch);
        expect(preset.defaults.hasDeciderTiebreak).toBe(engineDefault.hasDeciderTiebreak);
        expect(preset.defaults.deciderThreshold).toBe(engineDefault.deciderThreshold);
        expect(preset.defaults.deciderPoints).toBe(engineDefault.deciderPoints);
        expect(preset.defaults.winByTwo).toBe(engineDefault.winByTwo);
        expect(preset.defaults.pointsRule).toBeDefined();
      }

      // Check specific expected sport rules per spec
      const tt = PRESET_OPTIONS.find((p) => p.id === "table_tennis")!.defaults;
      expect(tt.singularUnit).toBe("Set");
      expect(tt.pluralUnit).toBe("Sety");
      expect(tt.targetPointsPerUnit).toBe(11);
      expect(tt.unitsToWinMatch).toBe(2);
      expect(tt.hasDeciderTiebreak).toBe(true);
      expect(tt.deciderPoints).toBe(15);
      expect(tt.winByTwo).toBe(true);
      expect(tt.pointsRule).toBe("2_1_matrix");

      const padel = PRESET_OPTIONS.find((p) => p.id === "padel")!.defaults;
      expect(padel.singularUnit).toBe("Gem");
      expect(padel.pluralUnit).toBe("Gemy");
      expect(padel.targetPointsPerUnit).toBe(6);
      expect(padel.unitsToWinMatch).toBe(2);
      expect(padel.hasDeciderTiebreak).toBe(false);
      expect(padel.winByTwo).toBe(true);
      expect(padel.pointsRule).toBe("standard_3_1_0");

      const football = PRESET_OPTIONS.find((p) => p.id === "football")!.defaults;
      expect(football.singularUnit).toBe("Połowa");
      expect(football.pluralUnit).toBe("Połowy");
      expect(football.targetPointsPerUnit).toBe(1);
      expect(football.unitsToWinMatch).toBe(1);
      expect(football.hasDeciderTiebreak).toBe(false);
      expect(football.winByTwo).toBe(false);
      expect(football.pointsRule).toBe("standard_3_1_0");

      const esport = PRESET_OPTIONS.find((p) => p.id === "esport")!.defaults;
      expect(esport.singularUnit).toBe("Mapa");
      expect(esport.pluralUnit).toBe("Mapy");
      expect(esport.targetPointsPerUnit).toBe(13);
      expect(esport.unitsToWinMatch).toBe(2);
      expect(esport.hasDeciderTiebreak).toBe(false);
      expect(esport.winByTwo).toBe(true);
      expect(esport.pointsRule).toBe("2_1_matrix");

      const custom = PRESET_OPTIONS.find((p) => p.id === "custom")!.defaults;
      expect(custom.singularUnit).toBe("Set");
      expect(custom.pluralUnit).toBe("Sety");
      expect(custom.targetPointsPerUnit).toBe(11);
      expect(custom.unitsToWinMatch).toBe(2);
      expect(custom.hasDeciderTiebreak).toBe(false);
      expect(custom.winByTwo).toBe(true);
      expect(custom.pointsRule).toBe("2_1_matrix");
    });

    it("verifies exhaustive 5x5 preset transition matrix without residual parameter leakage", () => {
      for (const sourcePreset of allPresets) {
        for (const targetPreset of allPresets) {
          const handleChange = vi.fn();
          const sourceDefaults = PRESET_OPTIONS.find((p) => p.id === sourcePreset)!.defaults;
          const targetDefaults = PRESET_OPTIONS.find((p) => p.id === targetPreset)!.defaults;

          const { unmount } = render(
            <SportWizard
              initialState={{
                preset: sourcePreset,
                ...sourceDefaults,
              }}
              onChange={handleChange}
            />
          );

          // Click target preset button
          const targetOption = PRESET_OPTIONS.find((p) => p.id === targetPreset)!;
          const targetButton = screen.getByText(targetOption.title).closest("button");
          expect(targetButton).not.toBeNull();
          fireEvent.click(targetButton!);

          // Check that target preset parameters are cleanly applied
          expect(handleChange).toHaveBeenCalled();
          const updatedState: WizardSportState =
            handleChange.mock.calls[handleChange.mock.calls.length - 1][0];

          expect(updatedState.preset).toBe(targetPreset);
          expect(updatedState.singularUnit).toBe(targetDefaults.singularUnit);
          expect(updatedState.pluralUnit).toBe(targetDefaults.pluralUnit);
          expect(updatedState.targetPointsPerUnit).toBe(targetDefaults.targetPointsPerUnit);
          expect(updatedState.unitsToWinMatch).toBe(targetDefaults.unitsToWinMatch);
          expect(updatedState.hasDeciderTiebreak).toBe(targetDefaults.hasDeciderTiebreak);
          expect(updatedState.deciderThreshold).toBe(targetDefaults.deciderThreshold);
          expect(updatedState.deciderPoints).toBe(targetDefaults.deciderPoints);
          expect(updatedState.winByTwo).toBe(targetDefaults.winByTwo);
          expect(updatedState.pointsRule).toBe(targetDefaults.pointsRule);

          unmount();
        }
      }
    });

    it("scrubs heavily contaminated 'dirty state' parameters when switching to any preset", () => {
      const contaminatedDirtyState: WizardSportState = {
        preset: "custom",
        singularUnit: "BrudnaPartia",
        pluralUnit: "BrudnePartie",
        targetPointsPerUnit: 999,
        unitsToWinMatch: 99,
        hasDeciderTiebreak: true,
        deciderThreshold: 10,
        deciderPoints: 888,
        winByTwo: false,
        pointsRule: "standard_3_1_0",
        allowPlayerScoreSubmission: false,
      };

      for (const targetPreset of allPresets) {
        const handleChange = vi.fn();
        const targetDefaults = PRESET_OPTIONS.find((p) => p.id === targetPreset)!.defaults;

        const { unmount } = render(
          <SportWizard
            initialState={contaminatedDirtyState}
            onChange={handleChange}
          />
        );

        const targetOption = PRESET_OPTIONS.find((p) => p.id === targetPreset)!;
        const targetButton = screen.getByText(targetOption.title).closest("button");
        fireEvent.click(targetButton!);

        const state: WizardSportState =
          handleChange.mock.calls[handleChange.mock.calls.length - 1][0];

        // Verify zero leakage from contaminatedDirtyState
        expect(state.singularUnit).toBe(targetDefaults.singularUnit);
        expect(state.pluralUnit).toBe(targetDefaults.pluralUnit);
        expect(state.targetPointsPerUnit).toBe(targetDefaults.targetPointsPerUnit);
        expect(state.unitsToWinMatch).toBe(targetDefaults.unitsToWinMatch);
        expect(state.hasDeciderTiebreak).toBe(targetDefaults.hasDeciderTiebreak);
        expect(state.deciderPoints).toBe(targetDefaults.deciderPoints);
        expect(state.winByTwo).toBe(targetDefaults.winByTwo);
        expect(state.pointsRule).toBe(targetDefaults.pointsRule);

        // Permissions toggle choice must be safely preserved during preset switch
        expect(state.allowPlayerScoreSubmission).toBe(false);

        unmount();
      }
    });

    it("restores complete pristine FSS defaults when reset button is clicked", () => {
      const handleChange = vi.fn();
      render(
        <SportWizard
          initialState={{
            preset: "football",
            singularUnit: "Połowa",
            pluralUnit: "Połowy",
            targetPointsPerUnit: 1,
            unitsToWinMatch: 1,
            hasDeciderTiebreak: false,
            deciderThreshold: 0,
            deciderPoints: 0,
            winByTwo: false,
            pointsRule: "standard_3_1_0",
            allowPlayerScoreSubmission: false,
          }}
          onChange={handleChange}
        />
      );

      const resetBtn = screen.getByText("Domyślne FSS").closest("button");
      expect(resetBtn).not.toBeNull();
      fireEvent.click(resetBtn!);

      const resetState: WizardSportState =
        handleChange.mock.calls[handleChange.mock.calls.length - 1][0];

      expect(resetState).toEqual(DEFAULT_WIZARD_STATE);
      expect(resetState.preset).toBe("table_tennis");
      expect(resetState.singularUnit).toBe("Set");
      expect(resetState.pluralUnit).toBe("Sety");
      expect(resetState.targetPointsPerUnit).toBe(11);
      expect(resetState.unitsToWinMatch).toBe(2);
      expect(resetState.hasDeciderTiebreak).toBe(true);
      expect(resetState.deciderPoints).toBe(15);
      expect(resetState.winByTwo).toBe(true);
      expect(resetState.pointsRule).toBe("2_1_matrix");
      expect(resetState.allowPlayerScoreSubmission).toBe(true);
    });
  });

  // ==========================================================================
  // SUITE 2: allowPlayerScoreSubmission Toggle & Payload Propagation
  // ==========================================================================
  describe("2. allowPlayerScoreSubmission Permissions Toggle", () => {
    it("toggles permission state and reflects immediately across LiveCardPreview and Summary", () => {
      const handleChange = vi.fn();
      render(<SportWizard onChange={handleChange} />);

      // Initially active
      expect(screen.getByText("Wprowadzanie graczy: Aktywne")).toBeDefined();
      expect(screen.getByText("Dozwolone")).toBeDefined();

      // Find switch
      const switches = screen.getAllByRole("switch");
      // Switch 2 is allowPlayerScoreSubmission
      const playerSwitch = switches[2];
      expect(playerSwitch.getAttribute("aria-checked")).toBe("true");

      // Toggle OFF
      fireEvent.click(playerSwitch);

      expect(handleChange).toHaveBeenCalled();
      const stateOff: WizardSportState =
        handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(stateOff.allowPlayerScoreSubmission).toBe(false);

      expect(screen.getByText("Wprowadzanie graczy: Blokada")).toBeDefined();
      expect(screen.getByText("Zablokowane")).toBeDefined();
      expect(playerSwitch.getAttribute("aria-checked")).toBe("false");

      // Toggle ON
      fireEvent.click(playerSwitch);

      const stateOn: WizardSportState =
        handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
      expect(stateOn.allowPlayerScoreSubmission).toBe(true);

      expect(screen.getByText("Wprowadzanie graczy: Aktywne")).toBeDefined();
      expect(screen.getByText("Dozwolone")).toBeDefined();
      expect(playerSwitch.getAttribute("aria-checked")).toBe("true");
    });

    it("preserves player permission toggle state across multiple preset switches", () => {
      const handleChange = vi.fn();
      render(<SportWizard onChange={handleChange} />);

      // Toggle permissions to false
      const playerSwitch = screen.getAllByRole("switch")[2];
      fireEvent.click(playerSwitch);
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].allowPlayerScoreSubmission).toBe(false);

      // Switch to Padel
      const padelBtn = screen.getByText("Padel").closest("button");
      fireEvent.click(padelBtn!);
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].preset).toBe("padel");
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].allowPlayerScoreSubmission).toBe(false);

      // Switch to Football
      const footballBtn = screen.getByText("Piłka nożna").closest("button");
      fireEvent.click(footballBtn!);
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].preset).toBe("football");
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].allowPlayerScoreSubmission).toBe(false);

      // Switch to E-sport
      const esportBtn = screen.getByText("E-sport").closest("button");
      fireEvent.click(esportBtn!);
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].preset).toBe("esport");
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0].allowPlayerScoreSubmission).toBe(false);
    });

    it("propagates allowPlayerScoreSubmission to onSave callback payload", async () => {
      const handleSave = vi.fn();
      render(
        <SportWizard
          initialState={{ allowPlayerScoreSubmission: false }}
          onSave={handleSave}
        />
      );

      const saveButtons = screen.getAllByRole("button", {
        name: /Zatwierdź & Kontynuuj|Utwórz Konfigurację/,
      });
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });

      expect(handleSave).toHaveBeenCalledTimes(1);
      const savedPayload: WizardSportState = handleSave.mock.calls[0][0];
      expect(savedPayload.allowPlayerScoreSubmission).toBe(false);
    });

    it("verifies Convex database persistence of allowPlayerScoreSubmission in create and update mutations", async () => {
      const store = new MockConvexStore(false);

      // 1. Create tournament with allowPlayerScoreSubmission: false
      const createRes = await store.executeMutation("tournaments:create", {
        name: "Test Permissions Cup",
        slug: "test-permissions-cup",
        sportPreset: "padel",
        allowPlayerScoreSubmission: false,
      });

      expect(createRes.tournamentId).toBeDefined();

      const createdTourn = store.getQueryResult("tournaments:getBySlug", {
        slug: "test-permissions-cup",
      });
      expect(createdTourn).not.toBeNull();
      expect(createdTourn.allowPlayerScoreSubmission).toBe(false);

      // 2. Update settings via tournament update mutation
      await store.executeMutation("tournaments:updateSettings", {
        tournamentId: createRes.tournamentId,
        adminSecret: createRes.adminSecret,
        allowPlayerScoreSubmission: true,
      });

      const updatedTourn = store.getQueryResult("tournaments:getBySlug", {
        slug: "test-permissions-cup",
      });
      expect(updatedTourn.allowPlayerScoreSubmission).toBe(true);
    });
  });

  // ==========================================================================
  // SUITE 3: pointsRule Standings Engine Equivalence & Divergence Proof
  // ==========================================================================
  describe("3. pointsRule Standings Engine Equivalence & Live Preview Alignment", () => {
    it("computes exact points breakdown for 2_1_matrix vs standard_3_1_0 across all match outcomes", () => {
      const players = ["pA", "pB"];

      // Case 1: 2:0 win
      const match2_0: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          status: "completed",
          sets: [
            { s1: 11, s2: 8 },
            { s1: 11, s2: 6 },
          ],
        },
      ];

      const standings2_0_matrix = calculateStandings(players, match2_0, "2_1_matrix");
      expect(standings2_0_matrix.find((s) => s.playerId === "pA")!.points).toBe(2);
      expect(standings2_0_matrix.find((s) => s.playerId === "pB")!.points).toBe(0);

      const standings2_0_std = calculateStandings(players, match2_0, "standard_3_1_0");
      expect(standings2_0_std.find((s) => s.playerId === "pA")!.points).toBe(3);
      expect(standings2_0_std.find((s) => s.playerId === "pB")!.points).toBe(0);

      // Case 2: 2:1 win (Key Matrix differentiator: loser gets 1 point!)
      const match2_1: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          status: "completed",
          sets: [
            { s1: 11, s2: 8 },
            { s1: 9, s2: 11 },
            { s1: 15, s2: 13 },
          ],
        },
      ];

      const standings2_1_matrix = calculateStandings(players, match2_1, "2_1_matrix");
      expect(standings2_1_matrix.find((s) => s.playerId === "pA")!.points).toBe(2);
      expect(standings2_1_matrix.find((s) => s.playerId === "pB")!.points).toBe(1); // 1 point for 1 set won!

      const standings2_1_std = calculateStandings(players, match2_1, "standard_3_1_0");
      expect(standings2_1_std.find((s) => s.playerId === "pA")!.points).toBe(3);
      expect(standings2_1_std.find((s) => s.playerId === "pB")!.points).toBe(0); // 0 points in standard!

      // Case 3: 1:2 loss for pA (pB wins 2:1)
      const match1_2: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          status: "completed",
          sets: [
            { s1: 9, s2: 11 },
            { s1: 11, s2: 8 },
            { s1: 13, s2: 15 },
          ],
        },
      ];

      const standings1_2_matrix = calculateStandings(players, match1_2, "2_1_matrix");
      expect(standings1_2_matrix.find((s) => s.playerId === "pA")!.points).toBe(1);
      expect(standings1_2_matrix.find((s) => s.playerId === "pB")!.points).toBe(2);

      const standings1_2_std = calculateStandings(players, match1_2, "standard_3_1_0");
      expect(standings1_2_std.find((s) => s.playerId === "pA")!.points).toBe(0);
      expect(standings1_2_std.find((s) => s.playerId === "pB")!.points).toBe(3);

      // Case 4: 1:1 draw (Football format)
      const match1_1: MatchResultInput[] = [
        {
          player1Id: "pA",
          player2Id: "pB",
          status: "completed",
          sets: [{ s1: 1, s2: 1 }],
        },
      ];

      const standings1_1_matrix = calculateStandings(players, match1_1, "2_1_matrix");
      expect(standings1_1_matrix.find((s) => s.playerId === "pA")!.points).toBe(0);
      expect(standings1_1_matrix.find((s) => s.playerId === "pB")!.points).toBe(0);

      const standings1_1_std = calculateStandings(players, match1_1, "standard_3_1_0");
      expect(standings1_1_std.find((s) => s.playerId === "pA")!.points).toBe(1);
      expect(standings1_1_std.find((s) => s.playerId === "pB")!.points).toBe(1);
    });

    it("empirically demonstrates table rank divergence between 2_1_matrix and standard_3_1_0", () => {
      // Mathematically clean rank inversion between Player A and Player B:
      // Player A plays 2 matches and wins both 2:0.
      // -> Matrix points: 2 + 2 = 4 pts.
      // -> Standard points: 3 + 3 = 6 pts. (Set diff: 4-0 = +4)
      //
      // Player B plays 3 matches: wins two 2:1, loses one 1:2.
      // -> Matrix points: 2 + 2 + 1 = 5 pts.
      // -> Standard points: 3 + 3 + 0 = 6 pts. (Set diff: 5-4 = +1)
      //
      // Empirical Result:
      // Under 2_1_matrix: Player B has 5 pts, Player A has 4 pts -> Player B is Rank 1, Player A is Rank 2!
      // Under standard_3_1_0: Both have 6 pts, but Player A has +4 set diff vs Player B +1 -> Player A is Rank 1, Player B is Rank 2!

      const players = ["playerA", "playerB", "playerC", "playerD"];
      const matches: MatchResultInput[] = [
        // Player A vs C: 2:0
        {
          player1Id: "playerA",
          player2Id: "playerC",
          status: "completed",
          sets: [
            { s1: 11, s2: 5 },
            { s1: 11, s2: 7 },
          ],
        },
        // Player A vs D: 2:0
        {
          player1Id: "playerA",
          player2Id: "playerD",
          status: "completed",
          sets: [
            { s1: 11, s2: 6 },
            { s1: 11, s2: 8 },
          ],
        },
        // Player B vs C: 2:1
        {
          player1Id: "playerB",
          player2Id: "playerC",
          status: "completed",
          sets: [
            { s1: 11, s2: 7 },
            { s1: 8, s2: 11 },
            { s1: 15, s2: 13 },
          ],
        },
        // Player B vs D: 2:1
        {
          player1Id: "playerB",
          player2Id: "playerD",
          status: "completed",
          sets: [
            { s1: 11, s2: 9 },
            { s1: 7, s2: 11 },
            { s1: 15, s2: 12 },
          ],
        },
        // Player C vs B: 2:1 (B loses 1:2, gaining +1 pt in matrix, 0 in standard)
        {
          player1Id: "playerC",
          player2Id: "playerB",
          status: "completed",
          sets: [
            { s1: 11, s2: 9 },
            { s1: 8, s2: 11 },
            { s1: 15, s2: 13 },
          ],
        },
      ];

      const standingsMatrix = calculateStandings(players, matches, "2_1_matrix");
      const standingsStd = calculateStandings(players, matches, "standard_3_1_0");

      const standingA_matrix = standingsMatrix.find((s) => s.playerId === "playerA")!;
      const standingB_matrix = standingsMatrix.find((s) => s.playerId === "playerB")!;

      const standingA_std = standingsStd.find((s) => s.playerId === "playerA")!;
      const standingB_std = standingsStd.find((s) => s.playerId === "playerB")!;

      // In 2_1_matrix: Player B has 5 pts, Player A has 4 pts
      expect(standingB_matrix.points).toBe(5);
      expect(standingA_matrix.points).toBe(4);
      expect(standingB_matrix.rank).toBe(1);
      expect(standingA_matrix.rank).toBe(2);

      // In standard_3_1_0: Both have 6 pts, but Player A has +4 set diff vs Player B +1
      expect(standingA_std.points).toBe(6);
      expect(standingB_std.points).toBe(6);
      expect(standingA_std.setDifference).toBe(4);
      expect(standingB_std.setDifference).toBe(1);
      expect(standingA_std.rank).toBe(1);
      expect(standingB_std.rank).toBe(2);
    });

    it("verifies LiveCardPreview standings points text matches engine calculation exactly", () => {
      // 1. In 2_1_matrix with decider (Bo3: 2:1 score simulated in LiveCardPreview)
      const { unmount: unmount1 } = render(
        <LiveCardPreview
          state={{
            ...DEFAULT_WIZARD_STATE,
            pointsRule: "2_1_matrix",
            hasDeciderTiebreak: true,
            unitsToWinMatch: 2,
          }}
        />
      );

      // Verify +2 and +1 points rendered
      expect(screen.getByText(/Antek:/).textContent).toContain("+2 pkt");
      expect(screen.getByText(/Tomasz:/).textContent).toContain("+1 pkt");
      expect(screen.getByText(/Matrix 2:1 -> 2 pkt dla wygranego, 1 pkt dla przegranego/)).toBeDefined();
      unmount1();

      // 2. In standard_3_1_0 (Bo3: 2:1 score simulated)
      const { unmount: unmount2 } = render(
        <LiveCardPreview
          state={{
            ...DEFAULT_WIZARD_STATE,
            pointsRule: "standard_3_1_0",
            hasDeciderTiebreak: true,
            unitsToWinMatch: 2,
          }}
        />
      );

      expect(screen.getByText(/Antek:/).textContent).toContain("+3 pkt");
      expect(screen.getByText(/Tomasz:/).textContent).toContain("+0 pkt");
      expect(screen.getByText(/Standard 3-1-0 -> 3 pkt dla wygranego, 0 pkt dla przegranego/)).toBeDefined();
      unmount2();

      // 3. In 2_1_matrix without decider (2:0 score simulated)
      const { unmount: unmount3 } = render(
        <LiveCardPreview
          state={{
            ...DEFAULT_WIZARD_STATE,
            pointsRule: "2_1_matrix",
            hasDeciderTiebreak: false,
            unitsToWinMatch: 2,
          }}
        />
      );

      expect(screen.getByText(/Antek:/).textContent).toContain("+2 pkt");
      expect(screen.getByText(/Tomasz:/).textContent).toContain("+0 pkt");
      expect(screen.getByText(/Matrix 2:0 -> 2 pkt dla wygranego, 0 pkt dla przegranego/)).toBeDefined();
      unmount3();
    });
  });

  // ==========================================================================
  // SUITE 4: Boundary & Edge Inoculations
  // ==========================================================================
  describe("4. Boundary Conditions & Stepper Clamping", () => {
    it("clamps stepper decrement to minimum of 1 point / unit", () => {
      const handleChange = vi.fn();
      render(
        <RuleParameters
          state={{
            ...DEFAULT_WIZARD_STATE,
            targetPointsPerUnit: 1,
            unitsToWinMatch: 1,
            deciderPoints: 1,
          }}
          onChange={handleChange}
        />
      );

      const minusBtns = screen.getAllByRole("button", { name: /Zmniejsz liczbę/ });
      // Target points minus button
      fireEvent.click(minusBtns[0]);
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });

      // Units to win minus button
      fireEvent.click(minusBtns[1]);
      expect(handleChange).toHaveBeenCalledWith({ unitsToWinMatch: 1 });
    });

    it("sanitizes manual numeric typing of 0 or negative numbers to minimum 1", () => {
      const handleChange = vi.fn();
      render(
        <RuleParameters
          state={DEFAULT_WIZARD_STATE}
          onChange={handleChange}
        />
      );

      const targetInput = screen.getByLabelText(/Do ilu punktów gra się/);
      fireEvent.change(targetInput, { target: { value: "-10" } });
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });

      fireEvent.change(targetInput, { target: { value: "0" } });
      expect(handleChange).toHaveBeenCalledWith({ targetPointsPerUnit: 1 });
    });

    it("dynamically generates correct Polish prompts for arbitrary singular/plural terms", () => {
      const testTerms = [
        { sing: "Gem", plur: "Gemy" },
        { sing: "Połowa", plur: "Połowy" },
        { sing: "Mapa", plur: "Mapy" },
        { sing: "Kolejka", plur: "Kolejki" },
        { sing: "Set", plur: "Sety" },
      ];

      for (const { sing, plur } of testTerms) {
        const prompts = generateDynamicPrompts(sing, plur);
        expect(prompts.targetPointsPrompt).toBe(`Do ilu punktów gra się ${sing}?`);
        expect(prompts.unitsToWinPrompt).toBe(`Do ilu ${plur} gra się, żeby wygrać mecz?`);
        expect(prompts.deciderTiebreakPrompt).toBe(`Czy jest tiebreak / decydujący ${sing} przy stanie 1:1?`);
      }
    });
  });
});
