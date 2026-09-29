import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SportWizard } from "../SportWizard";
import { DEFAULT_WIZARD_STATE, type WizardSportState } from "../types";
import { generateDynamicPrompts, validateMatchScore } from "../../../engine/scoring";

describe("SportWizard Component Suite", () => {
  it("renders default Table Tennis FSS configuration correctly", () => {
    render(<SportWizard />);

    // Check title and headers
    expect(screen.getByText("Kreator Dyscypliny & Punktacji")).toBeDefined();
    expect(screen.getByText("Tenis stołowy")).toBeDefined();

    // Check dynamic prompt interpolation for default units (Set / Sety)
    expect(screen.getByText("Do ilu punktów gra się Set?")).toBeDefined();
    expect(screen.getByText("Do ilu Sety gra się, żeby wygrać mecz?")).toBeDefined();
    expect(
      screen.getByText("Czy jest tiebreak / decydujący Set przy stanie 1:1?")
    ).toBeDefined();

    // Live preview should be visible and showing Set breakdown
    expect(screen.getByText(/Rozbicie wyników \(Sety\):/)).toBeDefined();
    expect(screen.getByText(/Set 1/)).toBeDefined();
    expect(screen.getByText(/Walidacja silnika: Poprawna/)).toBeDefined();
    expect(screen.getByText(/Wprowadzanie graczy: Aktywne/)).toBeDefined();
  });

  it("switches presets cleanly and updates all parameters and terminology", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Select Padel preset
    const padelButton = screen.getByText("Padel").closest("button");
    expect(padelButton).not.toBeNull();
    fireEvent.click(padelButton!);

    // Terminology should update to Gem / Gemy
    expect(screen.getByText("Do ilu punktów gra się Gem?")).toBeDefined();
    expect(screen.getByText("Do ilu Gemy gra się, żeby wygrać mecz?")).toBeDefined();
    expect(
      screen.getByText("Czy jest tiebreak / decydujący Gem przy stanie 1:1?")
    ).toBeDefined();

    // Check last onChange call
    expect(handleChange).toHaveBeenCalled();
    const lastCallState: WizardSportState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCallState.preset).toBe("padel");
    expect(lastCallState.singularUnit).toBe("Gem");
    expect(lastCallState.pluralUnit).toBe("Gemy");
    expect(lastCallState.targetPointsPerUnit).toBe(6);
    expect(lastCallState.unitsToWinMatch).toBe(2);
    expect(lastCallState.hasDeciderTiebreak).toBe(false);
    expect(lastCallState.pointsRule).toBe("standard_3_1_0");

    // Select Football preset
    const footballButton = screen.getByText("Piłka nożna").closest("button");
    fireEvent.click(footballButton!);

    expect(screen.getByText("Do ilu punktów gra się Połowa?")).toBeDefined();
    expect(screen.getByText("Do ilu Połowy gra się, żeby wygrać mecz?")).toBeDefined();
  });

  it("updates prompts dynamically when user types custom terminology (e.g. Głowa / Głowy)", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Find inputs for singular and plural units
    const singularInput = screen.getByLabelText(/Liczba pojedyncza/);
    const pluralInput = screen.getByLabelText(/Liczba mnoga/);

    fireEvent.change(singularInput, { target: { value: "Głowa" } });
    fireEvent.change(pluralInput, { target: { value: "Głowy" } });

    // Verify prompts interpolated with Głowa / Głowy
    expect(screen.getByText("Do ilu punktów gra się Głowa?")).toBeDefined();
    expect(screen.getByText("Do ilu Głowy gra się, żeby wygrać mecz?")).toBeDefined();
    expect(
      screen.getByText("Czy jest tiebreak / decydujący Głowa przy stanie 1:1?")
    ).toBeDefined();

    // Live preview breakdown should reflect Głowy
    expect(screen.getByText(/Rozbicie wyników \(Głowy\):/)).toBeDefined();
    expect(screen.getByText(/Głowa 1/)).toBeDefined();
  });

  it("allows selecting terminology from quick-fill chips", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Click "Mapa / Mapy" chip
    const chipButton = screen.getByText("Mapa / Mapy").closest("button");
    expect(chipButton).not.toBeNull();
    fireEvent.click(chipButton!);

    expect(screen.getByText("Do ilu punktów gra się Mapa?")).toBeDefined();
    expect(screen.getByText("Do ilu Mapy gra się, żeby wygrać mecz?")).toBeDefined();
  });

  it("toggles decider tiebreak and displays decider points input", () => {
    render(<SportWizard />);

    // In default Table Tennis, decider tiebreak is true, decider input should exist
    expect(screen.getByLabelText(/Punkty w decydującym Set/)).toBeDefined();

    // Toggle switch off
    const switches = screen.getAllByRole("switch");
    // Switch 0: Decider tiebreak, Switch 1: Win by 2, Switch 2: Player submission
    const deciderSwitch = switches[0];
    fireEvent.click(deciderSwitch);

    // Decider points input should now be hidden
    expect(screen.queryByLabelText(/Punkty w decydującym Set/)).toBeNull();

    // Toggle switch back on
    fireEvent.click(deciderSwitch);
    expect(screen.getByLabelText(/Punkty w decydującym Set/)).toBeDefined();
  });

  it("updates points rule between 2_1_matrix and standard_3_1_0", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Switch to standard_3_1_0
    const standardCard = screen.getByText(/Standard ligowy \(3 \/ 1 \/ 0\)/).closest("button");
    fireEvent.click(standardCard!);

    const state1 = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(state1.pointsRule).toBe("standard_3_1_0");

    // Switch back to 2_1_matrix
    const matrixCard = screen.getByText(/Matrix setowy FSS/).closest("button");
    fireEvent.click(matrixCard!);

    const state2 = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(state2.pointsRule).toBe("2_1_matrix");
  });

  it("toggles player score submission permission", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Find the player score submission switch (3rd switch)
    const switches = screen.getAllByRole("switch");
    const playerSwitch = switches[2];

    expect(screen.getByText(/Wprowadzanie graczy: Aktywne/)).toBeDefined();

    fireEvent.click(playerSwitch);

    expect(screen.getByText(/Wprowadzanie graczy: Blokada/)).toBeDefined();
    const lastState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastState.allowPlayerScoreSubmission).toBe(false);
  });

  it("calls onSave when save button is clicked with current state", async () => {
    const handleSave = vi.fn();
    render(<SportWizard onSave={handleSave} mode="create" />);

    const saveButtons = screen.getAllByRole("button", { name: /Zatwierdź & Kontynuuj|Utwórz Konfigurację/ });
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedState: WizardSportState = handleSave.mock.calls[0][0];
    expect(savedState.preset).toBe("table_tennis");
    expect(savedState.singularUnit).toBe("Set");
    expect(savedState.pluralUnit).toBe("Sety");
    expect(savedState.targetPointsPerUnit).toBe(11);
    expect(savedState.unitsToWinMatch).toBe(2);
    expect(savedState.hasDeciderTiebreak).toBe(true);
    expect(savedState.deciderPoints).toBe(15);
  });

  it("resets to defaults when reset button is clicked", () => {
    render(
      <SportWizard
        initialState={{
          preset: "football",
          singularUnit: "Gol",
          pluralUnit: "Gole",
          targetPointsPerUnit: 1,
          unitsToWinMatch: 1,
          hasDeciderTiebreak: false,
          winByTwo: false,
        }}
      />
    );

    expect(screen.getByText("Do ilu punktów gra się Gol?")).toBeDefined();

    // Click reset
    const resetButton = screen.getByText("Domyślne FSS").closest("button");
    fireEvent.click(resetButton!);

    // Should be restored to Table Tennis FSS defaults
    expect(screen.getByText("Do ilu punktów gra się Set?")).toBeDefined();
    expect(screen.getByText("Do ilu Sety gra się, żeby wygrać mecz?")).toBeDefined();
  });

  it("verifies live preview matches scoring engine validation and points logic", () => {
    // Check scoring engine directly with mock data
    const rules = {
      preset: "table_tennis" as const,
      singularUnit: "Set",
      pluralUnit: "Sety",
      targetPointsPerUnit: 11,
      unitsToWinMatch: 2,
      hasDeciderTiebreak: true,
      deciderThreshold: 1,
      deciderPoints: 15,
      winByTwo: true,
    };

    const validSets = [
      { s1: 11, s2: 9 },
      { s1: 8, s2: 11 },
      { s1: 15, s2: 13 },
    ];

    const result = validateMatchScore(validSets, rules);
    expect(result.isValid).toBe(true);
    expect(result.isMatchCompleted).toBe(true);
    expect(result.winner).toBe(1);
    expect(result.setsWonP1).toBe(2);
    expect(result.setsWonP2).toBe(1);
  });

  it("handles custom sport preset and numeric steppers (increment/decrement)", () => {
    const handleChange = vi.fn();
    render(<SportWizard onChange={handleChange} />);

    // Select Custom Sport preset
    const customButton = screen.getByText("Własny sport").closest("button");
    fireEvent.click(customButton!);

    expect(handleChange).toHaveBeenCalled();
    const customState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(customState.preset).toBe("custom");

    // Click increment for target points
    const incTargetBtn = screen.getByLabelText("Zwiększ liczbę punktów");
    fireEvent.click(incTargetBtn);

    const incState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(incState.targetPointsPerUnit).toBe(12);

    // Click decrement for target points
    const decTargetBtn = screen.getByLabelText("Zmniejsz liczbę punktów");
    fireEvent.click(decTargetBtn);

    const decState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(decState.targetPointsPerUnit).toBe(11);

    // Stepper for unitsToWinMatch
    const incUnitsBtn = screen.getByLabelText("Zwiększ liczbę partii");
    fireEvent.click(incUnitsBtn);
    const unitsState = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(unitsState.unitsToWinMatch).toBe(3);
  });

  it("handles single-unit match (e.g. football 1 połowa) in live preview", () => {
    render(
      <SportWizard
        initialState={{
          preset: "football",
          singularUnit: "Połowa",
          pluralUnit: "Połowy",
          targetPointsPerUnit: 1,
          unitsToWinMatch: 1,
          hasDeciderTiebreak: false,
          winByTwo: false,
          pointsRule: "standard_3_1_0",
        }}
      />
    );

    // Live preview should show only 1 set
    expect(screen.getByText(/Połowa 1/)).toBeDefined();
    expect(screen.queryByText(/Połowa 2/)).toBeNull();
    expect(screen.getByText(/Standard 3-1-0 -> 3 pkt dla wygranego/)).toBeDefined();
  });
});

