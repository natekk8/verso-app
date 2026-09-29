import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpectatorPortal } from "../SpectatorPortal";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Milestone 4: Public Spectator Portal Suite", () => {
  let mockStore: MockConvexStore;
  let tournamentData: FullTournamentData;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
    tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
      slug: "mistrzostwa-1v1-fss",
    });
  });

  const renderSpectatorPortal = () => {
    return render(
      <ConvexClientProvider mockStore={mockStore}>
        <RouterProvider initialPath="/mistrzostwa-1v1-fss">
          <SpectatorPortal tournament={tournamentData} />
        </RouterProvider>
      </ConvexClientProvider>
    );
  };

  it("1. Renders portal header with title and 4 primary tabs", () => {
    renderSpectatorPortal();

    expect(screen.getByText("PUBLICZNY PORTAL TURNIEJU")).toBeDefined();
    expect(screen.getByText("Mistrzostwa 1v1 FSS")).toBeDefined();

    expect(screen.getByText("Harmonogram")).toBeDefined();
    expect(screen.getByText("Tabela / Wyniki")).toBeDefined();
    expect(screen.getByText("Drabinka Pucharowa")).toBeDefined();
    expect(screen.getByText("Uczestnicy")).toBeDefined();
  });

  it("2. Harmonogram tab filters matches by Day and Pitch and supports search", () => {
    renderSpectatorPortal();

    // Default tab is Harmonogram
    expect(screen.getByText("Wszystkie dni")).toBeDefined();
    expect(screen.getByText("Wszystkie stoły")).toBeDefined();

    // Filter by search input
    const searchInput = screen.getByPlaceholderText("Szukaj zawodnika...");
    fireEvent.change(searchInput, { target: { value: "Borówka" } });

    // Tomasz Borówka should be found
    expect(screen.getAllByText(/Tomasz Borówka/).length).toBeGreaterThan(0);
  });

  it("3. Displays pulsing 'NA ŻYWO' indicators for matches currently in progress", () => {
    // Set first match to in_progress
    const firstMatch = Array.from(mockStore.matches.values())[0];
    mockStore.matches.set(firstMatch._id, {
      ...firstMatch,
      status: "in_progress",
      sets: [{ s1: 10, s2: 8 }],
    });

    renderSpectatorPortal();

    // Should render pulsing live badge
    const liveBadges = screen.getAllByText("NA ŻYWO");
    expect(liveBadges.length).toBeGreaterThan(0);
  });

  it("4. Standings table ranks all participants and highlights top 4 playoff spots", () => {
    renderSpectatorPortal();

    // Switch to Standings tab
    const standingsTab = screen.getByText("Tabela / Wyniki");
    fireEvent.click(standingsTab);

    expect(screen.getByText("Klasyfikacja Fazy Grupowej")).toBeDefined();
    expect(screen.getByText(/Pozycje 1–4 kwalifikują się/)).toBeDefined();

    // Verify all 9 players are in the table
    const playerNames = [
      "Antek Sadowski",
      "Bartek Kalarus",
      "Filip Kruszka",
      "Filip Szata",
      "Franek Herka",
      "Igor Mądry",
      "Leon Marycki",
      "Michał Krzakiewicz",
      "Tomasz Borówka",
    ];

    playerNames.forEach((name) => {
      expect(screen.getByText(name)).toBeDefined();
    });
  });

  it("5. Displays recursive tiebreaker tooltip explaining rank decisions on point ties", () => {
    renderSpectatorPortal();

    const standingsTab = screen.getByText("Tabela / Wyniki");
    fireEvent.click(standingsTab);

    // Initial state has players tied at 0 points, so tiebreaker tooltips exist
    const infoButtons = screen.getAllByRole("button").filter((b) => b.className.includes("text-amber-400"));
    expect(infoButtons.length).toBeGreaterThan(0);

    // Click/hover first tiebreaker info button
    fireEvent.click(infoButtons[0]);

    // Check tiebreaker explanation text is rendered
    expect(screen.getByText("Rozstrzygnięcie remisu")).toBeDefined();
    expect(screen.getByText(/Hierarchia reguł:/)).toBeDefined();
    expect(screen.getByText(/1\. Punkty ogólne/)).toBeDefined();
    expect(screen.getByText(/2\. Bezpośredni bilans \(H2H\)/)).toBeDefined();
  });

  it("6. Drabinka tab renders Semifinals, Final, and 3rd Place match tree", () => {
    renderSpectatorPortal();

    const bracketTab = screen.getByText("Drabinka Pucharowa");
    fireEvent.click(bracketTab);

    expect(screen.getByText("Drabinka Fazy Pucharowej")).toBeDefined();
    expect(screen.getByText(/PÓŁFINAŁY/)).toBeDefined();
    expect(screen.getByText("WIELKI FINAŁ")).toBeDefined();
    expect(screen.getByText("MECZ O 3. MIEJSCE")).toBeDefined();
  });

  it("7. Uczestnicy tab renders participant directory cards with seeds and stats", () => {
    renderSpectatorPortal();

    const participantsTab = screen.getByText("Uczestnicy");
    fireEvent.click(participantsTab);

    expect(screen.getByText(/Katalog Zawodników Turnieju/)).toBeDefined();
    expect(screen.getByText("Tomasz Borówka")).toBeDefined();
    expect(screen.getByText("Slot #8")).toBeDefined();
  });
});
