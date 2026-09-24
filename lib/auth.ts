// ============================================================
// VERSO — Auth Helpers (admin token management via localStorage)
// ============================================================

const STORAGE_KEY_PREFIX = "verso_admin_";
const ALL_TOKENS_KEY = "verso_admin_tokens";

// ─── Store admin token for a tournament ──────────────────────
export function setAdminToken(tournamentId: string, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${tournamentId}`, token);

  // Track all admin tournament IDs
  const existing = getAdminTournamentIds();
  if (!existing.includes(tournamentId)) {
    localStorage.setItem(ALL_TOKENS_KEY, JSON.stringify([...existing, tournamentId]));
  }
}

// ─── Get admin token for a tournament ────────────────────────
export function getAdminToken(tournamentId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${tournamentId}`);
}

// ─── Check if current user is admin of a tournament ──────────
export function isAdmin(tournamentId: string): boolean {
  return getAdminToken(tournamentId) !== null;
}

// ─── Remove admin token (logout from managing a tournament) ──
export function removeAdminToken(tournamentId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tournamentId}`);

  const existing = getAdminTournamentIds();
  localStorage.setItem(
    ALL_TOKENS_KEY,
    JSON.stringify(existing.filter((id) => id !== tournamentId)),
  );
}

// ─── Get all tournament IDs where user is admin ───────────────
export function getAdminTournamentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALL_TOKENS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Get all admin sessions ───────────────────────────────────
export function getAdminSessions(): Array<{ tournamentId: string; token: string }> {
  const ids = getAdminTournamentIds();
  return ids
    .map((id) => ({ tournamentId: id, token: getAdminToken(id) ?? "" }))
    .filter((s) => s.token !== "");
}

// ─── Generate a new admin token ───────────────────────────────
export function generateAdminToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// ─── Generate a player token ──────────────────────────────────
export function generatePlayerToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
