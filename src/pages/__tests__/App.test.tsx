import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../../App";
import {
  ConvexClientProvider,
  MockConvexStore,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Milestone 4: Full App Routing & Role Switcher Suite", () => {
  let mockStore: MockConvexStore;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
  });

  const renderApp = (initialPath: string = "/") => {
    return render(<App initialPath={initialPath} mockStore={mockStore} />);
  };

  it("1. Renders Home landing page at root path '/'", () => {
    renderApp("/");

    expect(screen.getByText("Precyzyjne zarządzanie turniejami sportowymi")).toBeDefined();
    expect(screen.getByText("Uruchom pokazowy turniej FSS")).toBeDefined();
    expect(screen.getByText("Stwórz nowy turniej")).toBeDefined();
  });

  it("2. Renders 404 page when tournament slug does not exist", async () => {
    renderApp("/nonexistent-tournament-slug-xyz");

    await waitFor(() => {
      expect(screen.getByText("Turniej nie został odnaleziony")).toBeDefined();
      expect(screen.getByText("Wróć do strony głównej")).toBeDefined();
    });
  });

  it("3. Renders Public Spectator Portal with Navbar for '/mistrzostwa-1v1-fss'", async () => {
    renderApp("/mistrzostwa-1v1-fss");

    await waitFor(() => {
      expect(screen.getByText("VERSO")).toBeDefined();
      expect(screen.getByText("PUBLICZNY PORTAL TURNIEJU")).toBeDefined();
      expect(screen.getByText("Widz")).toBeDefined();
      expect(screen.getByText("Organizator")).toBeDefined();
      expect(screen.getByText("Zawodnik")).toBeDefined();
      expect(screen.getByText("Sędzia")).toBeDefined();
      expect(screen.getByText("TV Kiosk")).toBeDefined();
    });
  });

  it("4. Quick role switcher transitions between roles smoothly", async () => {
    renderApp("/mistrzostwa-1v1-fss");

    await waitFor(() => {
      expect(screen.getByText("Organizator")).toBeDefined();
    });

    // Click Organizator button — without valid token, should show auth screen
    const adminBtn = screen.getByText("Organizator");
    fireEvent.click(adminBtn);

    await waitFor(() => {
      // Security: without adminSecret in URL, auth screen is shown, not the admin panel
      expect(screen.getByText("Wymagana autoryzacja organizatora")).toBeDefined();
    });

    // Click Sędzia button
    const refBtn = screen.getByText("Sędzia");
    fireEvent.click(refBtn);

    await waitFor(() => {
      expect(screen.getByText("TERMINAL SĘDZIEGO")).toBeDefined();
    });

    // Click TV Kiosk
    const kioskBtn = screen.getByText("TV Kiosk");
    fireEvent.click(kioskBtn);

    await waitFor(() => {
      expect(screen.getByText("VENUE TV")).toBeDefined();
    });
  });
});
