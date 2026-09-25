"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  getAdminSessions,
  setAdminToken,
  generateAdminToken,
} from "@/lib/auth";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Plus,
  CalendarBlank,
  ArrowRight,
  X,
  Spinner,
  Football,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ─── Geometric V Logo Mark ────────────────────────────────────────────────────
function VersoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Verso"
    >
      <rect width="32" height="32" rx="8" fill="#3b82f6" />
      <path
        d="M7 9L16 23L25 9"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 9L16 17L20.5 9"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-zinc-800 text-zinc-400 border border-zinc-700",
    },
    active: {
      label: "Active",
      className: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    },
    finished: {
      label: "Finished",
      className:
        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-[148px] overflow-hidden">
      {/* shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      <div className="flex items-start justify-between mb-4">
        <div className="h-4 w-40 rounded bg-zinc-800" />
        <div className="h-5 w-14 rounded-md bg-zinc-800" />
      </div>
      <div className="h-3 w-24 rounded bg-zinc-800 mb-6" />
      <div className="h-px w-full bg-zinc-800 mb-3" />
      <div className="h-3 w-20 rounded bg-zinc-800" />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="flex flex-col items-center justify-center py-28 text-center"
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <Trophy weight="duotone" className="w-9 h-9 text-blue-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 border-2 border-zinc-950 flex items-center justify-center">
          <Plus weight="bold" className="w-3 h-3 text-white" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-2 tracking-tight">
        No tournaments yet
      </h2>
      <p className="text-sm text-zinc-500 max-w-[280px] leading-relaxed mb-8">
        Create your first tournament and start managing brackets, players, and
        match days.
      </p>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors duration-150 shadow-lg shadow-blue-500/20"
      >
        <Plus weight="bold" className="w-4 h-4" />
        Create tournament
      </button>
    </motion.div>
  );
}

// ─── Create Panel (slide-down inline) ────────────────────────────────────────
function CreatePanel({
  open,
  onClose,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, sport: string) => Promise<void>;
  isCreating: boolean;
}) {
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus name input when panel opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 120);
      return () => clearTimeout(t);
    } else {
      // Reset on close
      setName("");
      setSport("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;
    await onCreate(name.trim(), sport.trim());
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="overflow-hidden"
        >
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
                New tournament
              </h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                aria-label="Close"
              >
                <X weight="bold" className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="t-name"
                    className="text-xs font-medium text-zinc-400"
                  >
                    Tournament name
                    <span className="text-blue-500 ml-0.5">*</span>
                  </Label>
                  <Input
                    ref={nameRef}
                    id="t-name"
                    placeholder="e.g. Summer 1v1 Championship"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/70 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="t-sport"
                    className="text-xs font-medium text-zinc-400"
                  >
                    Sport{" "}
                    <span className="text-zinc-600 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="t-sport"
                    placeholder="e.g. Table Tennis, Football…"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/70 h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !name.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors duration-150 shadow-md shadow-blue-500/20"
                >
                  {isCreating ? (
                    <>
                      <Spinner className="w-3.5 h-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus weight="bold" className="w-3.5 h-3.5" />
                      Create tournament
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────────────
function TournamentCard({
  tournament,
  index,
}: {
  tournament: {
    _id: Id<"tournaments">;
    name: string;
    sport?: string;
    status: string;
    _creationTime: number;
    matchDays: { id: string; date: string }[];
  };
  index: number;
}) {
  const createdAt = new Date(tournament._creationTime).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 26,
        delay: index * 0.055,
      }}
    >
      <Link href={`/t/${tournament._id}/manage/general`} className="block group">
        <div
          className={[
            "relative p-5 rounded-xl border border-zinc-800 bg-zinc-900",
            "transition-all duration-200",
            "hover:border-blue-500/40 hover:bg-zinc-900/80 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_8px_32px_rgba(0,0,0,0.4)]",
            "hover:scale-[1.015]",
            "flex flex-col justify-between h-full min-h-[148px]",
          ].join(" ")}
        >
          {/* Top row */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold text-[15px] text-zinc-100 leading-snug tracking-tight line-clamp-2 group-hover:text-white transition-colors">
                {tournament.name}
              </h3>
              <StatusBadge status={tournament.status} />
            </div>

            {tournament.sport && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Football className="w-3 h-3 shrink-0" />
                <span>{tournament.sport}</span>
              </div>
            )}
          </div>

          {/* Bottom meta row */}
          <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-600 pt-4 mt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <CalendarBlank className="w-3 h-3 shrink-0" />
              <span>Created {createdAt}</span>
            </div>

            {tournament.matchDays.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-700">·</span>
                <span>
                  {tournament.matchDays.length} match day
                  {tournament.matchDays.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Hover arrow */}
          <div
            className={[
              "absolute right-4 top-1/2 -translate-y-1/2",
              "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
              "transition-all duration-200 text-blue-400",
            ].join(" ")}
          >
            <ArrowRight weight="bold" className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [adminIds, setAdminIds] = useState<Id<"tournaments">[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const sessions = getAdminSessions();
    setAdminIds(sessions.map((s) => s.tournamentId as Id<"tournaments">));
  }, []);

  const tournaments = useQuery(api.tournaments.getByIds, { ids: adminIds });
  const createTournament = useMutation(api.tournaments.create);

  const handleCreate = async (name: string, sport: string) => {
    try {
      setIsCreating(true);
      const token = generateAdminToken();
      const id = await createTournament({
        name,
        sport: sport || undefined,
        adminToken: token,
      });
      setAdminToken(id, token);
      toast.success("Tournament created!");
      router.push(`/t/${id}/manage/general`);
    } catch {
      toast.error("Failed to create tournament.");
      setIsCreating(false);
    }
  };

  // Derived states
  const isLoading = tournaments === undefined && adminIds.length > 0;
  const isEmpty =
    !isLoading &&
    (adminIds.length === 0 ||
      (Array.isArray(tournaments) && tournaments.length === 0));
  const hasTournaments =
    Array.isArray(tournaments) && tournaments.length > 0;

  const filtered = hasTournaments
    ? (tournaments as NonNullable<typeof tournaments>).filter(
        (t): t is NonNullable<typeof t> => t !== null
      )
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 h-14 border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <VersoMark className="w-8 h-8 shrink-0" />
            <span className="font-bold tracking-[0.18em] text-sm text-zinc-100 hidden sm:block select-none">
              VERSO
            </span>
          </div>

          {/* New tournament button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setPanelOpen((v) => !v)}
            className={[
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150",
              panelOpen
                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20",
            ].join(" ")}
          >
            <motion.span
              animate={{ rotate: panelOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex"
            >
              <Plus weight="bold" className="w-3.5 h-3.5" />
            </motion.span>
            <span className="hidden sm:inline">New tournament</span>
          </motion.button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page title row */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="mb-7"
        >
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            Your tournaments
          </h1>
          {hasTournaments && (
            <p className="text-sm text-zinc-500 mt-1">
              {filtered.length} tournament{filtered.length !== 1 ? "s" : ""}{" "}
              managed by you
            </p>
          )}
        </motion.div>

        {/* ── Create panel (slide-down) ── */}
        <CreatePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onCreate={handleCreate}
          isCreating={isCreating}
        />

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div className="grid sm:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && <EmptyState onOpen={() => setPanelOpen(true)} />}

        {/* ── Tournament grid ── */}
        {hasTournaments && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((t, i) => (
              <TournamentCard key={t._id} tournament={t} index={i} />
            ))}
          </div>
        )}
      </main>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
