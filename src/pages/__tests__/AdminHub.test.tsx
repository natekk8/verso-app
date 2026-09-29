import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { AdminHub } from "../AdminHub";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
  FSS_SEED,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Milestone 4: Organizer Admin Hub Suite", () => {
  let mockStore: MockConvexStore;
  let tournamentData: FullTournamentData;

  beforeEach(() => {
    // Fresh in-memory mock store without persistence
    mockStore = new MockConvexStore(false);
    tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
  });

  const renderAdminHub = (adminSecret: string = "adm_fss_secret_2026") => {
    return render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath={`/mistrzostwa-1v1-fss/admin/${adminSecret}`}>
          <AdminHub tournament={tournamentData} adminSecret={adminSecret} />
        </RouterProvider>
      </ConvexClientProvider>
    );
  };

  it("1. Rehydrates admin session from LocalStorage when visiting without URL secret", () => {
    // Put token in localStorage
    window.localStorage.setItem("verso_admin_mistrzostwa-1v1-fss", "adm_fss_secret_2026");

    render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath="/mistrzostwa-1v1-fss/admin">
          <AdminHub tournament={tournamentData} />
        </RouterProvider>
      </ConvexClientProvider>
    );

    // Should render the admin hub header directly
    expect(screen.getByText("PANEL ORGANIZATORA (ADMIN HUB)")).toBeDefined();
    expect(screen.getByText("Mistrzostwa 1v1 FSS")).toBeDefined();
  });

  it("2. Displays unauthenticated screen when secret is missing and not in localStorage", () => {
    window.localStorage.removeItem("verso_admin_mistrzostwa-1v1-fss");

    render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath="/mistrzostwa-1v1-fss/admin">
          <AdminHub tournament={tournamentData} />
        </RouterProvider>
      </ConvexClientProvider>
    );

    expect(screen.getByText("Wymagana autoryzacja organizatora")).toBeDefined();
    expect(screen.getByText("Zaloguj do Panelu")).toBeDefined();
  });

  it("3. Participant Desk displays slot indices (#0 to #8) and toggles check-in", async () => {
    renderAdminHub();

    // Roster header and slot indices
    expect(screen.getByText("Biurko Odprawy & Lista Zawodników")).toBeDefined();
    expect(screen.getByText("Tomasz Borówka")).toBeDefined();
    expect(screen.getByText("#8")).toBeDefined(); // Tomasz Borówka is slot #8
    expect(screen.getByText("Antek Sadowski")).toBeDefined();
    expect(screen.getByText("#0")).toBeDefined(); // Antek is slot #0

    // Check-in toggle buttons
    const checkInButtons = screen.getAllByText(/Obecny|Oczekuje/);
    expect(checkInButtons.length).toBeGreaterThan(0);

    const firstButton = checkInButtons[0];
    const initialText = firstButton.textContent;
    await act(async () => {
      fireEvent.click(firstButton);
    });

    // Should update status
    await waitFor(() => {
      expect(firstButton.textContent).not.toBe(initialText);
    });
  });

  it("4. Adds a new participant via single participant input", async () => {
    renderAdminHub();

    // Open Add Player modal
    const addBtn = screen.getByText("Dodaj zawodnika");
    fireEvent.click(addBtn);

    expect(screen.getByText("Dodaj Zawodnika")).toBeDefined();
    const input = screen.getByPlaceholderText("np. Jan Kowalski");
    fireEvent.change(input, { target: { value: "Kamil Stoch" } });

    const submitBtn = screen.getAllByText("Dodaj").find((b) => b.tagName === "BUTTON" && b.className.includes("bg-emerald-500"));
    expect(submitBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(submitBtn!);
    });

    // Verify player is now in the table
    await waitFor(() => {
      expect(screen.getByText("Kamil Stoch")).toBeDefined();
    });
  });

  it("5. Schedule Matrix evaluates validateScheduleIntegrity and shows conflict warnings on rest violations", async () => {
    // Intentionally inject two overlapping / 0-rest matches into mockStore for player-1
    const p1 = Array.from(mockStore.players.values())[0];
    const p2 = Array.from(mockStore.players.values())[1];
    const p3 = Array.from(mockStore.players.values())[2];
    const day1 = Array.from(mockStore.days.values())[0];
    const pitch1 = Array.from(mockStore.pitches.values())[0];
    const pitch2 = Array.from(mockStore.pitches.values())[1];

    mockStore.matches.set("conflict_m1", {
      _id: "conflict_m1",
      _creationTime: Date.now(),
      tournamentId: tournamentData._id,
      stageId: "stage_1",
      dayId: day1._id,
      pitchId: pitch1._id,
      time: "18:00",
      endTime: "18:20",
      startTimestamp: Date.parse(`${day1.date}T18:00:00Z`),
      endTimestamp: Date.parse(`${day1.date}T18:20:00Z`),
      roundNumber: 1,
      player1Id: p1._id,
      player2Id: p2._id,
      sets: [],
      status: "pending",
    });

    mockStore.matches.set("conflict_m2", {
      _id: "conflict_m2",
      _creationTime: Date.now(),
      tournamentId: tournamentData._id,
      stageId: "stage_1",
      dayId: day1._id,
      pitchId: pitch2._id,
      time: "18:22", // Gap is only 2 minutes (< 10 min rest interval!)
      endTime: "18:42",
      startTimestamp: Date.parse(`${day1.date}T18:22:00Z`),
      endTimestamp: Date.parse(`${day1.date}T18:42:00Z`),
      roundNumber: 2,
      player1Id: p1._id, // Same player p1!
      player2Id: p3._id,
      sets: [],
      status: "pending",
    });

    renderAdminHub();

    // Switch to Schedule tab
    const schedTab = screen.getByText("Harmonogram & Stoły");
    fireEvent.click(schedTab);

    // Verify conflict warning banner is displayed
    expect(screen.getByText(/Wykryto kolizje w harmonogramie/)).toBeDefined();
    expect(screen.getAllByText(/rest violation/).length).toBeGreaterThan(0);
  });

  it("6. Scorekeeper & Walkover handlers allow entering scores and setting walkovers", async () => {
    // Reset match sets to empty so it starts fresh with 1 empty set in score modal
    const targetMatch = mockStore.matches.get("match_fss_ga_1");
    if (targetMatch) {
      targetMatch.sets = [];
      targetMatch.status = "pending";
    }

    renderAdminHub();

    // Switch to Wyniki tab
    const scoringTab = screen.getByText("Wyniki & Walkowery");
    fireEvent.click(scoringTab);

    expect(screen.getByText("Rejestracja Wyników & Walkowery")).toBeDefined();

    // Find and click first "Wprowadź wynik" button
    const enterScoreBtns = screen.getAllByText("Wprowadź wynik");
    fireEvent.click(enterScoreBtns[0]);

    // Score modal should open
    expect(screen.getByText("Wprowadź Wynik Meczu")).toBeDefined();

    // Set valid scores for 2:0 table tennis (11:9, 11:7)
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "11" } });
    fireEvent.change(inputs[1], { target: { value: "9" } });

    // Add set 2
    fireEvent.click(screen.getByText("+ Dodaj set"));
    const updatedInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(updatedInputs[2], { target: { value: "11" } });
    fireEvent.change(updatedInputs[3], { target: { value: "7" } });

    // Save score
    const saveBtn = screen.getByText("Zapisz Wynik");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Score modal should close
    await waitFor(() => {
      expect(screen.queryByText("Wprowadź Wynik Meczu")).toBeNull();
    });
  });

  it("7. Secret Sharing Center displays copyable links for all tournament roles", () => {
    renderAdminHub();

    // Switch to sharing tab
    const sharingTab = screen.getByText("Centrum Linków");
    fireEvent.click(sharingTab);

    expect(screen.getByText("Centrum Dystrybucji Linków")).toBeDefined();
    expect(screen.getByText("Publiczny Portal Kibica")).toBeDefined();
    expect(screen.getByText("Terminal Sędziowski")).toBeDefined();
    expect(screen.getByText("Prezenter TV na Hali")).toBeDefined();
    expect(screen.getByText("Bezpośredni Link Admina")).toBeDefined();
    expect(screen.getByText(/Indywidualne Terminale Zawodników/)).toBeDefined();
  });

  it("8. Sport Rules Editor tab renders SportWizard in edit mode and allows saving settings", async () => {
    renderAdminHub();

    // Switch to rules tab
    const rulesTab = screen.getByText("Zasady Gry");
    fireEvent.click(rulesTab);

    expect(screen.getByText("Zasady Punktacji i Reguły Gry")).toBeDefined();
    expect(screen.getByText("Zezwalaj zawodnikom na wprowadzanie wyników:")).toBeDefined();

    // Change unit to 15
    const targetPtsInput = screen.getByDisplayValue("11");
    fireEvent.change(targetPtsInput, { target: { value: "15" } });

    // Click save in SportWizard
    const saveRulesBtn = screen.getByText("Zapisz Reguły");
    await act(async () => {
      fireEvent.click(saveRulesBtn);
    });
  });
});
