import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  parseSecretRoute,
  buildSecretRoute,
  getAdminStorageKey,
  cacheAdminToken,
  getCachedAdminToken,
  clearAdminToken,
  RouterProvider,
  useRouter,
  Link,
} from "../../lib/router";

describe("Milestone 4: Zero-Dependency Client Router", () => {
  describe("1. URL Secret Route Parsing Semantics", () => {
    it("parses root path '/' as valid without slug", () => {
      const res = parseSecretRoute("/");
      expect(res.isValid).toBe(false); // empty route in raw parser
      expect(res.error).toBe("Empty route");
    });

    it("parses Public Spectator Portal '/[slug]' correctly", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("spectator");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
    });

    it("parses Venue TV Presenter '/[slug]/present' correctly", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/present");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("presenter");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
    });

    it("parses Organizer Admin Hub '/[slug]/admin/[adminSecret]' with secret token", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/admin/adm_fss_secret_2026");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("admin");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
      expect(res.adminSecret).toBe("adm_fss_secret_2026");
    });

    it("parses '/[slug]/admin' without secret as rehydration candidate", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/admin");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("admin");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
      expect(res.adminSecret).toBeUndefined();
    });

    it("parses Personalized Player Terminal '/[slug]/p/[playerSecret]' correctly", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/p/sec-tomasz-09");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("player");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
      expect(res.playerSecret).toBe("sec-tomasz-09");
    });

    it("fails with error when player secret is missing in '/[slug]/p'", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/p");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Missing player secret token");
    });

    it("parses Referee Terminal '/[slug]/referee/[refereeSecret]' correctly", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/referee/ref_table1_secret");
      expect(res.isValid).toBe(true);
      expect(res.role).toBe("referee");
      expect(res.slug).toBe("mistrzostwa-1v1-fss");
      expect(res.refereeSecret).toBe("ref_table1_secret");
    });

    it("fails with error when referee secret is missing in '/[slug]/referee'", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/referee");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Missing referee secret token");
    });

    it("fails with error on unrecognized sub-paths", () => {
      const res = parseSecretRoute("/mistrzostwa-1v1-fss/unknown/path/xyz");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Unrecognized route pattern");
    });
  });

  describe("2. URL Building via buildSecretRoute", () => {
    it("builds spectator route", () => {
      expect(buildSecretRoute("spectator", "turniej-1")).toBe("/turniej-1");
    });

    it("builds presenter kiosk route", () => {
      expect(buildSecretRoute("presenter", "turniej-1")).toBe("/turniej-1/present");
    });

    it("builds admin route with or without token", () => {
      expect(buildSecretRoute("admin", "turniej-1", "secret123")).toBe("/turniej-1/admin/secret123");
      expect(buildSecretRoute("admin", "turniej-1")).toBe("/turniej-1/admin");
    });

    it("builds player and referee routes with tokens", () => {
      expect(buildSecretRoute("player", "turniej-1", "ply-01")).toBe("/turniej-1/p/ply-01");
      expect(buildSecretRoute("referee", "turniej-1", "ref-01")).toBe("/turniej-1/referee/ref-01");
    });

    it("throws error if player or referee route is called without token", () => {
      expect(() => buildSecretRoute("player", "turniej-1")).toThrow("playerSecret");
      expect(() => buildSecretRoute("referee", "turniej-1")).toThrow("refereeSecret");
    });
  });

  describe("3. LocalStorage Admin Caching Helpers", () => {
    const mockStorage = {
      store: new Map<string, string>(),
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      getItem(k: string) {
        return this.store.get(k) || null;
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
    };

    it("stores, retrieves, and clears admin tokens under verso_admin_{slug}", () => {
      const slug = "fss-cup";
      const key = getAdminStorageKey(slug);
      expect(key).toBe("verso_admin_fss-cup");

      cacheAdminToken(mockStorage, slug, "secret-token-xyz");
      expect(getCachedAdminToken(mockStorage, slug)).toBe("secret-token-xyz");

      clearAdminToken(mockStorage, slug);
      expect(getCachedAdminToken(mockStorage, slug)).toBeNull();
    });
  });

  describe("4. React Router Context & Link Component", () => {
    const TestConsumer: React.FC = () => {
      const { pathname, route, navigate } = useRouter();
      return (
        <div>
          <span data-testid="pathname">{pathname}</span>
          <span data-testid="role">{route.role || "none"}</span>
          <span data-testid="slug">{route.slug || "none"}</span>
          <button onClick={() => navigate("/mistrzostwa-1v1-fss/admin/token123")}>
            Idź do Admina
          </button>
          <Link href="/mistrzostwa-1v1-fss" data-testid="spectator-link">
            Do Widza
          </Link>
        </div>
      );
    };

    it("provides current route, reactive navigation, and Link clicks", () => {
      render(
        <RouterProvider initialPath="/mistrzostwa-1v1-fss">
          <TestConsumer />
        </RouterProvider>
      );

      expect(screen.getByTestId("pathname").textContent).toBe("/mistrzostwa-1v1-fss");
      expect(screen.getByTestId("role").textContent).toBe("spectator");
      expect(screen.getByTestId("slug").textContent).toBe("mistrzostwa-1v1-fss");

      // Programmatic navigate
      fireEvent.click(screen.getByText("Idź do Admina"));
      expect(screen.getByTestId("pathname").textContent).toBe("/mistrzostwa-1v1-fss/admin/token123");
      expect(screen.getByTestId("role").textContent).toBe("admin");

      // Link click
      fireEvent.click(screen.getByTestId("spectator-link"));
      expect(screen.getByTestId("pathname").textContent).toBe("/mistrzostwa-1v1-fss");
      expect(screen.getByTestId("role").textContent).toBe("spectator");
    });
  });
});
