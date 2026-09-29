import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { App } from "../../App";
import { AdminHub } from "../AdminHub";
import { PlayerTerminal } from "../PlayerTerminal";
import { RefereeTerminal } from "../RefereeTerminal";
import {
  ConvexClientProvider,
  MockConvexStore,
  FullTournamentData,
  FSS_SEED,
  api,
} from "../../lib/convex-client";
import { RouterProvider } from "../../lib/router";

describe("Challenger M4 Empirical Adversarial Test Suite", () => {
  let mockStore: MockConvexStore;

  beforeEach(() => {
    mockStore = new MockConvexStore(false);
    window.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Admin Authorization & Invalid Secret Boundary (Adversarial Breach)", () => {
    it("FAIL-SECURITY-01: accessing /[slug]/admin/invalidSecret must fail authorization and render unauthenticated screen", async () => {
      // In a secure system, accessing an admin route with an invalid secret must NOT grant admin access.
      render(<App initialPath="/mistrzostwa-1v1-fss/admin/invalidSecret" mockStore={mockStore} />);

      // Expected: "Wymagana autoryzacja organizatora" must be rendered, and admin hub panel must NOT be rendered.
      const unauthHeading = screen.queryByText("Wymagana autoryzacja organizatora");
      const adminHubBadge = screen.queryByText("PANEL ORGANIZATORA (ADMIN HUB)");

      expect(unauthHeading).not.toBeNull();
      expect(adminHubBadge).toBeNull();
    });

    it("FAIL-SECURITY-02: public visitor clicking 'Organizator' in Navbar must not automatically bypass authorization", async () => {
      // Visiting spectator portal
      render(<App initialPath="/mistrzostwa-1v1-fss" mockStore={mockStore} />);

      // Find and click "Organizator" role switcher in Navbar
      const orgBtn = screen.getByRole("button", { name: /Organizator/i });
      await act(async () => {
        fireEvent.click(orgBtn);
      });

      // Without a valid admin token in localStorage, it must show the authorization gate, NOT the admin panel
      const adminHubBadge = screen.queryByText("PANEL ORGANIZATORA (ADMIN HUB)");
      const unauthHeading = screen.queryByText("Wymagana autoryzacja organizatora");

      expect(adminHubBadge).toBeNull();
      expect(unauthHeading).not.toBeNull();
    });

    it("FAIL-SECURITY-03: typing an arbitrary invalid secret into the auth gate password field must not immediately grant admin access", async () => {
      // Visiting /mistrzostwa-1v1-fss/admin without secret
      render(<App initialPath="/mistrzostwa-1v1-fss/admin" mockStore={mockStore} />);

      expect(screen.getByText("Wymagana autoryzacja organizatora")).toBeDefined();

      const input = screen.getByPlaceholderText(/Wklej klucz adminSecret/i);
      // Type invalid key
      await act(async () => {
        fireEvent.change(input, { target: { value: "wrong-password-123" } });
      });

      // The admin panel must NOT immediately open for an invalid key
      const adminHubBadge = screen.queryByText("PANEL ORGANIZATORA (ADMIN HUB)");
      expect(adminHubBadge).toBeNull();
    });

    it("SEC-04: backend mutation rejects admin operations with invalid secret", async () => {
      // Verify that backend mutation updateScore strictly checks adminSecret
      const match = Array.from(mockStore.matches.values())[0];
      expect(match).toBeDefined();

      await expect(
        mockStore.executeMutation("matches:updateScore", {
          matchId: match._id,
          sets: [{ s1: 11, s2: 5 }, { s1: 11, s2: 4 }],
          adminSecret: "invalidSecretToken",
        })
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe("2. LocalStorage Tampering & Cross-Slug Session Hijacking", () => {
    it("FAIL-SECURITY-05: tampering with localStorage by setting an invalid token must not grant admin access", async () => {
      // Attacker injects fake token into localStorage
      window.localStorage.setItem("verso_admin_mistrzostwa-1v1-fss", "forged_hacker_token");

      render(<App initialPath="/mistrzostwa-1v1-fss/admin" mockStore={mockStore} />);

      // Should fail authorization because "forged_hacker_token" !== "adm_fss_secret_2026"
      const adminHubBadge = screen.queryByText("PANEL ORGANIZATORA (ADMIN HUB)");
      const unauthHeading = screen.queryByText("Wymagana autoryzacja organizatora");

      expect(adminHubBadge).toBeNull();
      expect(unauthHeading).not.toBeNull();
    });

    it("FAIL-SECURITY-06: cross-slug session hijacking — token from tournament A must not grant admin access to tournament B", async () => {
      // Create tournament B in mockStore
      await mockStore.executeMutation("tournaments:create", {
        name: "Turniej Padel Pro",
        slug: "turniej-padel-pro",
        adminSecret: "adm_padel_secret_999",
      });

      // User has legitimate admin token for tournament A ("adm_fss_secret_2026")
      // But tries to access tournament B using tournament A's token
      render(
        <App
          initialPath="/turniej-padel-pro/admin/adm_fss_secret_2026"
          mockStore={mockStore}
        />
      );

      // Must fail authorization on tournament B
      const unauthHeading = screen.queryByText("Wymagana autoryzacja organizatora");
      const adminHubBadge = screen.queryByText("PANEL ORGANIZATORA (ADMIN HUB)");

      expect(adminHubBadge).toBeNull();
      expect(unauthHeading).not.toBeNull();
    });

    it("SEC-07: legitimate admin token in localStorage correctly rehydrates", async () => {
      // Put genuine admin secret
      window.localStorage.setItem("verso_admin_mistrzostwa-1v1-fss", "adm_fss_secret_2026");

      // When tournamentData has adminSecret (or verified by backend)
      const tournamentWithSecret: FullTournamentData = {
        ...mockStore.getQueryResult("tournaments:getBySlug", { slug: "mistrzostwa-1v1-fss" }),
        adminSecret: "adm_fss_secret_2026",
      };

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/admin">
            <AdminHub tournament={tournamentWithSecret} />
          </RouterProvider>
        </ConvexClientProvider>
      );

      expect(screen.getByText("PANEL ORGANIZATORA (ADMIN HUB)")).toBeDefined();
    });
  });

  describe("3. Player Score Submission Permission Gate Enforcement", () => {
    it("PERM-01: when allowPlayerScoreSubmission is false, PlayerTerminal strictly renders the exact verbatim lock banner", async () => {
      const tournamentLocked: FullTournamentData = {
        ...mockStore.getQueryResult("tournaments:getBySlug", { slug: "mistrzostwa-1v1-fss" }),
        allowPlayerScoreSubmission: false,
      };

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/p/sec-tomasz-09">
            <PlayerTerminal tournament={tournamentLocked} playerSecret="sec-tomasz-09" />
          </RouterProvider>
        </ConvexClientProvider>
      );

      await waitFor(() => {
        // Must match exact user-specified string:
        expect(
          screen.getByText("Wyniki mogą wprowadzać wyłącznie sędziowie i organizatorzy")
        ).toBeDefined();
        // Score submission button must NOT be present
        expect(screen.queryByRole("button", { name: /Wprowadź wynik meczu/i })).toBeNull();
      });
    });

    it("PERM-02: when allowPlayerScoreSubmission is false, backend mutation submitPlayerScore strictly rejects", async () => {
      // Ensure tournament has allowPlayerScoreSubmission: false
      const tourn = mockStore.tournaments.get("tourn_fss");
      if (tourn) {
        tourn.allowPlayerScoreSubmission = false;
      }

      const player = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka");
      expect(player).toBeDefined();

      const match = Array.from(mockStore.matches.values()).find(
        (m) => m.player1Id === player?._id || m.player2Id === player?._id
      );
      expect(match).toBeDefined();

      await expect(
        mockStore.executeMutation("matches:submitPlayerScore", {
          matchId: match!._id,
          playerSecret: player!.secretCode,
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }],
        })
      ).rejects.toThrow(/disabled by tournament organizer/i);
    });

    it("PERM-03: player cannot submit score for match they do not participate in", async () => {
      const tourn = mockStore.tournaments.get("tourn_fss");
      if (tourn) tourn.allowPlayerScoreSubmission = true;

      const player = Array.from(mockStore.players.values()).find((p) => p.name === "Tomasz Borówka");
      // Find match where Tomasz Borówka is NOT playing
      const otherMatch = Array.from(mockStore.matches.values()).find(
        (m) => m.player1Id !== player?._id && m.player2Id !== player?._id
      );
      expect(otherMatch).toBeDefined();

      await expect(
        mockStore.executeMutation("matches:submitPlayerScore", {
          matchId: otherMatch!._id,
          playerSecret: player!.secretCode,
          sets: [{ s1: 11, s2: 7 }, { s1: 11, s2: 8 }],
        })
      ).rejects.toThrow(/not participating/i);
    });
  });

  describe("4. Referee 15-Second Undo Toast, Score Reversion & Timer Cleanup", () => {
    it("UNDO-01: Referee 15-second undo toast correctly reverts score changes", async () => {
      const pitch1 = mockStore.pitches.get("pitch_fss_1");
      if (pitch1) pitch1.refereeSecret = "ref_table1_secret";
      const tourn = mockStore.tournaments.get("tourn_fss");
      if (tourn) tourn.refereeSecret = "ref_table1_secret";

      const tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
        slug: "mistrzostwa-1v1-fss",
      });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/referee/ref_table1_secret">
            <RefereeTerminal tournament={tournamentData} refereeSecret="ref_table1_secret" />
          </RouterProvider>
        </ConvexClientProvider>
      );

      const submitBtn = screen.getByText("Zatwierdź Wynik");
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // 15-second undo toast must appear
      await waitFor(() => {
        expect(screen.getByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeDefined();
      });

      // Click "Cofnij"
      const undoBtn = screen.getByText("Cofnij");
      await act(async () => {
        fireEvent.click(undoBtn);
      });

      // Toast must disappear
      await waitFor(() => {
        expect(screen.queryByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeNull();
      });
    });

    it("UNDO-02: timer properly expires after 15 seconds and dismisses toast without error", async () => {
      vi.useFakeTimers();

      const pitch1 = mockStore.pitches.get("pitch_fss_1");
      if (pitch1) pitch1.refereeSecret = "ref_table1_secret";
      const tourn = mockStore.tournaments.get("tourn_fss");
      if (tourn) tourn.refereeSecret = "ref_table1_secret";

      const tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
        slug: "mistrzostwa-1v1-fss",
      });

      render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/referee/ref_table1_secret">
            <RefereeTerminal tournament={tournamentData} refereeSecret="ref_table1_secret" />
          </RouterProvider>
        </ConvexClientProvider>
      );

      const submitBtn = screen.getByText("Zatwierdź Wynik");
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Toast is present
      expect(screen.getByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeDefined();

      // Fast-forward 16 seconds
      act(() => {
        vi.advanceTimersByTime(16000);
      });

      // Toast should now be dismissed
      expect(screen.queryByText(/Zapisano wynik seta\. Cofnij \(15s\)/)).toBeNull();

      vi.useRealTimers();
    });

    it("UNDO-03: unmounting RefereeTerminal cleanly clears interval timers without memory leak", async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, "clearInterval");

      const pitch1 = mockStore.pitches.get("pitch_fss_1");
      if (pitch1) pitch1.refereeSecret = "ref_table1_secret";
      const tourn = mockStore.tournaments.get("tourn_fss");
      if (tourn) tourn.refereeSecret = "ref_table1_secret";

      const tournamentData = mockStore.getQueryResult("tournaments:getBySlug", {
        slug: "mistrzostwa-1v1-fss",
      });

      const { unmount } = render(
        <ConvexClientProvider mockStore={mockStore}>
          <RouterProvider initialPath="/mistrzostwa-1v1-fss/referee/ref_table1_secret">
            <RefereeTerminal tournament={tournamentData} refereeSecret="ref_table1_secret" />
          </RouterProvider>
        </ConvexClientProvider>
      );

      const submitBtn = screen.getByText("Zatwierdź Wynik");
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Unmount while 15s timer is running
      unmount();

      // clearInterval must have been invoked
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
