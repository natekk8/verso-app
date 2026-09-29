import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
  type AnchorHTMLAttributes,
} from "react";

export type UserRole = "admin" | "player" | "referee" | "spectator" | "presenter";

export interface ParsedRoute {
  isValid: boolean;
  role?: UserRole;
  slug?: string;
  adminSecret?: string;
  playerSecret?: string;
  refereeSecret?: string;
  error?: string;
}

/**
 * Validates and extracts tournament slug and passwordless secret tokens from URL paths.
 * Specifications:
 * - /: Home landing
 * - /[slug]: Public Spectator Portal
 * - /[slug]/present: Venue TV Presenter
 * - /[slug]/admin/[adminSecret]: Organizer Admin Hub
 * - /[slug]/admin: Admin Hub requiring LocalStorage rehydration
 * - /[slug]/p/[playerSecret]: Personalized Player Terminal
 * - /[slug]/referee/[refereeSecret]: Referee Pitch-Side Terminal
 */
export function parseSecretRoute(pathname: string): ParsedRoute {
  const normalized = pathname.startsWith("/") ? pathname : "/" + pathname;
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return { isValid: false, error: "Empty route" };
  }

  const slug = parts[0];

  // /[slug] -> Spectator
  if (parts.length === 1) {
    return { isValid: true, role: "spectator", slug };
  }

  // /[slug]/present -> Venue TV Kiosk
  if (parts.length === 2 && parts[1] === "present") {
    return { isValid: true, role: "presenter", slug };
  }

  // /[slug]/admin/[adminSecret]
  if (parts[1] === "admin") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "admin", slug, adminSecret: parts[2] };
    }
    // Visiting /[slug]/admin without token requires localStorage rehydration
    return { isValid: true, role: "admin", slug, adminSecret: undefined };
  }

  // /[slug]/p/[playerSecret]
  if (parts[1] === "p") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "player", slug, playerSecret: parts[2] };
    }
    return { isValid: false, error: "Missing player secret token in /p/ URL" };
  }

  // /[slug]/referee/[refereeSecret]
  if (parts[1] === "referee") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "referee", slug, refereeSecret: parts[2] };
    }
    return { isValid: false, error: "Missing referee secret token in /referee/ URL" };
  }

  return { isValid: false, error: `Unrecognized route pattern: ${pathname}` };
}

export function buildSecretRoute(
  role: UserRole,
  slug: string,
  secret?: string
): string {
  switch (role) {
    case "admin":
      return secret ? `/${slug}/admin/${secret}` : `/${slug}/admin`;
    case "player":
      if (!secret) throw new Error("Player route requires playerSecret");
      return `/${slug}/p/${secret}`;
    case "referee":
      if (!secret) throw new Error("Referee route requires refereeSecret");
      return `/${slug}/referee/${secret}`;
    case "presenter":
      return `/${slug}/present`;
    case "spectator":
      return `/${slug}`;
  }
}

// LocalStorage helpers
export const ADMIN_TOKEN_KEY_PREFIX = "verso_admin_";

export function getAdminStorageKey(slug: string): string {
  return `${ADMIN_TOKEN_KEY_PREFIX}${slug}`;
}

export function cacheAdminToken(
  storage: { setItem: (k: string, v: string) => void },
  slug: string,
  adminSecret: string
): void {
  storage.setItem(getAdminStorageKey(slug), adminSecret);
}

export function getCachedAdminToken(
  storage: { getItem: (k: string) => string | null },
  slug: string
): string | null {
  return storage.getItem(getAdminStorageKey(slug));
}

export function clearAdminToken(
  storage: { removeItem: (k: string) => void },
  slug: string
): void {
  storage.removeItem(getAdminStorageKey(slug));
}

export interface RouterContextValue {
  pathname: string;
  route: ParsedRoute;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  back: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export interface RouterProviderProps {
  children: ReactNode;
  initialPath?: string;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({
  children,
  initialPath,
}) => {
  const [pathname, setPathname] = useState<string>(() => {
    if (initialPath) return initialPath;
    if (typeof window !== "undefined" && window.location) {
      return window.location.pathname || "/";
    }
    return "/";
  });

  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLocationChange = () => {
      startTransition(() => {
        setPathname(window.location.pathname || "/");
      });
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("pushstate" as any, handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("pushstate" as any, handleLocationChange);
    };
  }, []);

  const navigate = (to: string, options?: { replace?: boolean }) => {
    if (typeof window !== "undefined") {
      if (options?.replace) {
        window.history.replaceState({}, "", to);
      } else {
        window.history.pushState({}, "", to);
      }
      window.dispatchEvent(new Event("pushstate"));
    }
    startTransition(() => {
      setPathname(to);
    });
  };

  const back = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const route = pathname === "/" ? { isValid: true, slug: undefined } : parseSecretRoute(pathname);

  return (
    <RouterContext.Provider value={{ pathname, route, navigate, back }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return ctx;
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  replace?: boolean;
}

export const Link: React.FC<LinkProps> = ({
  href,
  replace,
  onClick,
  children,
  ...props
}) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      e.button === 0 &&
      !props.target
    ) {
      e.preventDefault();
      navigate(href, { replace });
    }
    onClick?.(e);
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};
