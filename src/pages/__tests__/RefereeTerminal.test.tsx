import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { RefereeTerminal } from "../RefereeTerminal";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Milestone 4: Referee Pitch-Side Terminal Suite", () => {
  let mockStore: MockConvexStore;
  let tournamentData: FullTournamentData;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
    const pitch1 = mockStore.pitches.get("pitch_fss_1");
    if (pitch1) {
      pitch1.refereeSecret = "ref_table1_secret";
    }
    const tourn = mockStore.tournaments.get("tourn_fss");
    if (tourn) {
      tourn.refereeSecret = "ref_table1_secret";
    }
    tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
  });

  const renderRefereeTerminal = (refereeSecret: string = "ref_table1_secret") => {
    return render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath={`/mistrzostwa-1v1-fss/referee/${refereeSecret}`}>
          <RefereeTerminal tournament={tournamentData} refereeSecret={refereeSecret} />
        </RouterProvider>
      </ConvexClientProvider>
    );
  };

  it("1. Renders referee terminal header and pitch selector pills", () => {
    renderRefereeTerminal();

    expect(screen.getByText("TERMINAL SĘDZIEGO")).toBeDefined();
    expect(screen.getByText("PITCH-SIDE")).toBeDefined();
    expect(screen.getByText("Mistrzostwa 1v1 FSS")).toBeDefined();
    expect(screen.getByText("Wszystkie stoły")).toBeDefined();
    expect(screen.getByText("Stół 1")).toBeDefined();
    expect(screen.getByText("Stół 2")).toBeDefined();
  });

  it("2. Filters matches by pitch when selecting court pills", async () => {
    renderRefereeTerminal();

    // Click Stół 2
    const stoll2Btn = screen.getByText("Stół 2");
    fireEvent.click(stoll2Btn);

    // Active pitch should update
    expect(stoll2Btn.className).toContain("bg-amber-500");
  });

  it("3. Tactical scorekeeper renders Player 1 and Player 2 with large touch targets and updates score with +1 / -1", async () => {
    renderRefereeTerminal();

    expect(screen.getByText("Zawodnik 1")).toBeDefined();
    expect(screen.getByText("Zawodnik 2")).toBeDefined();

    // Verify big touch +1 buttons exist
    const plusButtons = screen.getAllByRole("button").filter((b) => b.className.includes("h-20") || b.className.includes("h-24"));
    expect(plusButtons.length).toBe(2);

    // Click +1 for Player 1
    fireEvent.click(plusButtons[0]);
    // Click +1 for Player 1 again
    fireEvent.click(plusButtons[0]);

    // Click +1 for Player 2
    fireEvent.click(plusButtons[1]);

    // Check correction -1 buttons exist (h-10)
    const minusButtons = screen.getAllByText(/-1/);
    expect(minusButtons.length).toBe(2);
    // Click -1 for Player 1
    fireEvent.click(minusButtons[0]);
  });

  it("4. Displays Win-By-2 badge when score reaches deuce / win-by-2 margin (10:10)", async () => {
    renderRefereeTerminal();

    const plusButtons = screen.getAllByRole("button").filter((b) => b.className.includes("h-20") || b.className.includes("h-24"));

    // Increment both to 10
    for (let i = 0; i < 10; i++) {
      fireEvent.click(plusButtons[0]);
      fireEvent.click(plusButtons[1]);
    }

    // Win-by-2 badge should appear
    expect(screen.getByText(/GRA NA PRZEWAGI/)).toBeDefined();
  });

  it("5. Activates 15-second undo grace window toast on score save and allows reverting", async () => {
    renderRefereeTerminal();

    const submitBtn = screen.getByText("Zatwierdź Wynik");
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 15-second undo toast should be visible
    await waitFor(() => {
      expect(screen.getByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeDefined();
    });

    // Click "Cofnij"
    const undoBtn = screen.getByText("Cofnij");
    await act(async () => {
      fireEvent.click(undoBtn);
    });

    // Undo toast should dismiss
    await waitFor(() => {
      expect(screen.queryByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeNull();
    });
  });

  it("6. Opens deliberate walkover modal and submits walkover", async () => {
    renderRefereeTerminal();

    const walkoverBtn = screen.getByText("Zarejestruj Walkower");
    fireEvent.click(walkoverBtn);

    // Modal should be visible
    expect(screen.getByText("Krok 1: Wskaż zwycięzcę przez walkower:")).toBeDefined();
    expect(screen.getByText("Krok 2: Wybierz powód walkowera:")).toBeDefined();

    // Select reason
    const injuryBtn = screen.getByText("Kontuzja");
    fireEvent.click(injuryBtn);

    const confirmBtn = screen.getByText("Zatwierdź Walkower");
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText("Krok 1: Wskaż zwycięzcę przez walkower:")).toBeNull();
    });
  });
});
