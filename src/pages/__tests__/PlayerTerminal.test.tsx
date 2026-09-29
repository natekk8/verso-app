import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PlayerTerminal, useCountdown } from "../PlayerTerminal";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Milestone 4: Personalized Player Terminal Suite", () => {
  let mockStore: MockConvexStore;
  let tournamentData: FullTournamentData;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
    tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
  });

  const renderPlayerTerminal = (
    playerSecret: string = "sec-tomasz-09",
    overrideTournament?: FullTournamentData
  ) => {
    return render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath={`/mistrzostwa-1v1-fss/p/${playerSecret}`}>
          <PlayerTerminal
            tournament={overrideTournament || tournamentData}
            playerSecret={playerSecret}
          />
        </RouterProvider>
      </ConvexClientProvider>
    );
  };

  it("1. Renders error message for invalid/unknown player secret", () => {
    renderPlayerTerminal("invalid-secret-code-999");

    expect(screen.getByText("Nieprawidłowy lub wygasły link zawodnika")).toBeDefined();
    expect(screen.getByText("Przejdź do portalu turnieju")).toBeDefined();
  });

  it("2. Resolves player identity correctly for Tomasz Borówka and displays slot badge", async () => {
    renderPlayerTerminal("sec-tomasz-09");

    await waitFor(() => {
      expect(screen.getByText("Tomasz Borówka")).toBeDefined();
      expect(screen.getByText("Slot #8")).toBeDefined();
      expect(screen.getByText("TERMINAL ZAWODNIKA")).toBeDefined();
    });
  });

  it("3. Toggles player check-in status from terminal banner", async () => {
    renderPlayerTerminal("sec-tomasz-09");

    await waitFor(() => {
      expect(screen.getByText("Tomasz Borówka")).toBeDefined();
    });

    const checkInBtn = screen.getByText("Obecność potwierdzona");
    await act(async () => {
      fireEvent.click(checkInBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Zamelduj obecność")).toBeDefined();
    });
  });

  it("4. Displays Next Match Spotlight Hero card with opponent, pitch, time, and countdown", async () => {
    renderPlayerTerminal("sec-tomasz-09");

    await waitFor(() => {
      expect(screen.getByText(/NAJBLIŻSZY MECZ/)).toBeDefined();
      expect(screen.getByText("Twój rywal")).toBeDefined();
      expect(screen.getByText("Czas do rozpoczęcia")).toBeDefined();
    });
  });

  it("5. When allowPlayerScoreSubmission is false, strictly renders exact lock banner: 'Wyniki mogą wprowadzać wyłącznie sędziowie i organizatorzy'", async () => {
    // Disable player submission in tournament
    const lockedTournament: FullTournamentData = {
      ...tournamentData,
      allowPlayerScoreSubmission: false,
    };

    renderPlayerTerminal("sec-tomasz-09", lockedTournament);

    await waitFor(() => {
      // Must match exact verbatim banner required by user request
      expect(
        screen.getByText("Wyniki mogą wprowadzać wyłącznie sędziowie i organizatorzy")
      ).toBeDefined();
      expect(screen.getByText(/Wprowadzanie wyników zostało zablokowane/)).toBeDefined();
      // "Wprowadź wynik meczu" button should NOT be present
      expect(screen.queryByText("Wprowadź wynik meczu")).toBeNull();
    });
  });

  it("6. When allowPlayerScoreSubmission is true, allows opening score drawer and validates score with validateMatchScore", async () => {
    const allowedTournament: FullTournamentData = {
      ...tournamentData,
      allowPlayerScoreSubmission: true,
    };

    renderPlayerTerminal("sec-tomasz-09", allowedTournament);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Wprowadź wynik meczu" })).toBeDefined();
    });

    // Open score drawer
    const openBtn = screen.getByRole("button", { name: "Wprowadź wynik meczu" });
    fireEvent.click(openBtn);

    // Score drawer should open
    expect(screen.getByRole("heading", { name: "Wprowadź wynik meczu" })).toBeDefined();
    expect(screen.getByText(/Ty \(Tomasz Borówka\)/)).toBeDefined();

    // Verify steppers exist
    const spinInputs = screen.getAllByRole("spinbutton");
    expect(spinInputs.length).toBeGreaterThanOrEqual(2);

    // Enter incomplete/invalid score (e.g. 5:5)
    fireEvent.change(spinInputs[0], { target: { value: "5" } });
    fireEvent.change(spinInputs[1], { target: { value: "5" } });

    // Should indicate match in progress or partial set
    expect(screen.getByText(/Mecz w toku/)).toBeDefined();
  });

  it("7. Displays personal match schedule timeline with filters and won/lost badges", async () => {
    renderPlayerTerminal("sec-tomasz-09");

    await waitFor(() => {
      expect(screen.getByText(/Twój Terminarz Meczów/)).toBeDefined();
      expect(screen.getByText("Wszystkie")).toBeDefined();
      expect(screen.getByText("Do rozegrania")).toBeDefined();
      expect(screen.getByText("Zakończone")).toBeDefined();
    });
  });
});
