"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { motion } from "motion/react";
import {
  Trophy,
  Handshake,
  WarningCircle,
  CalendarBlank,
  SmileyXEyes,
  ClockCountdown,
} from "@phosphor-icons/react";
import { PublicHeader } from "@/components/layout/public-header";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dicebearInitials(name: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e3a5f,1d4ed8,2563eb&textColor=ffffff&fontWeight=700&radius=50`;
}

function dicebearMicah(name: string) {
  return `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(name)}&backgroundColor=27272a`;
}

function formatSets(setsDetails: { p1: number; p2: number }[], isPlayer1: boolean) {
  const parts = setsDetails
    .map((s) => (isPlayer1 ? `${s.p1}-${s.p2}` : `${s.p2}-${s.p1}`))
    .join(", ");
  return `(${parts})`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 28 },
  },
};

function StatCard({
  value,
  label,
  color,
  icon,
  delay = 0,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay }}
      className="flex-1 min-w-[90px] bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-2"
    >
      <div className={`${color} opacity-80`}>{icon}</div>
      <span className={`text-4xl font-black tracking-tight ${color}`}>{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

type Match = {
  _id: string;
  player1Id: string | null;
  player2Id: string | null;
  player1Score?: number;
  player2Score?: number;
  player1Sets?: number;
  player2Sets?: number;
  setsDetails?: { p1: number; p2: number }[];
  status: "pending" | "in_progress" | "finished";
  matchLabel: string;
  scheduledTime?: string;
};

function MatchCard({
  match,
  playerId,
  players,
  index,
}: {
  match: Match;
  playerId: Id<"players">;
  players: { _id: string; name: string }[];
  index: number;
}) {
  const isPlayer1 = match.player1Id === playerId;
  const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
  const opponentName = players.find((p) => p._id === opponentId)?.name ?? "BYE";

  const isFinished = match.status === "finished";
  const isPending = match.status === "pending" || match.status === "in_progress";

  const myScore = isPlayer1 ? match.player1Score : match.player2Score;
  const theirScore = isPlayer1 ? match.player2Score : match.player1Score;

  let result: "win" | "draw" | "loss" | "pending" = "pending";
  if (isFinished && myScore !== undefined && theirScore !== undefined) {
    if (myScore > theirScore) result = "win";
    else if (myScore < theirScore) result = "loss";
    else result = "draw";
  }

  const resultConfig = {
    win: {
      pill: "W",
      pillCls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      borderCls: "border-emerald-500/25 hover:border-emerald-500/50",
      scoreCls: "text-emerald-400",
    },
    loss: {
      pill: "P",
      pillCls: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      borderCls: "border-rose-500/20 hover:border-rose-500/40",
      scoreCls: "text-rose-400",
    },
    draw: {
      pill: "R",
      pillCls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      borderCls: "border-amber-500/20 hover:border-amber-500/40",
      scoreCls: "text-amber-400",
    },
    pending: {
      pill: "Nadchodzący",
      pillCls: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      borderCls: "border-zinc-800 hover:border-zinc-700",
      scoreCls: "text-zinc-500",
    },
  }[result];

  // Set score string
  let setStr: string | null = null;
  if (isFinished && match.setsDetails && match.setsDetails.length > 0) {
    const mySets = isPlayer1 ? match.player1Sets : match.player2Sets;
    const theirSets = isPlayer1 ? match.player2Sets : match.player1Sets;
    setStr = `${mySets ?? 0}:${theirSets ?? 0} ${formatSets(match.setsDetails, isPlayer1)}`;
  }

  return (
    <motion.div
      variants={itemVariants}
      className={`bg-zinc-900 border ${resultConfig.borderCls} rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors duration-200`}
    >
      {/* Opponent */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={dicebearMicah(opponentName)}
          alt={opponentName}
          className="w-11 h-11 rounded-full border border-zinc-700 bg-zinc-800 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
            Przeciwnik
          </p>
          <p className="font-semibold text-zinc-100 truncate">{opponentName}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{match.matchLabel}</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Set scores */}
        {setStr && (
          <div className="hidden md:block text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              Sety
            </p>
            <p className={`text-sm font-mono font-semibold ${resultConfig.scoreCls}`}>
              {setStr}
            </p>
          </div>
        )}

        {/* Score / VS */}
        {isFinished ? (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              Wynik
            </p>
            <p className={`text-xl font-black font-mono tracking-tight ${resultConfig.scoreCls}`}>
              {myScore} : {theirScore}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-zinc-600">
            <ClockCountdown weight="duotone" className="w-4 h-4" />
            {match.scheduledTime && (
              <span className="text-xs font-mono">{match.scheduledTime}</span>
            )}
          </div>
        )}

        {/* Result pill */}
        <span
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border tracking-wide ${resultConfig.pillCls}`}
        >
          {resultConfig.pill}
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlayerDashboardPage({
  params,
}: {
  params: Promise<{ tournamentId: string; playerToken: string }>;
}) {
  const { tournamentId, playerToken } = use(params);

  const tournament = useQuery(api.tournaments.getPublic, {
    id: tournamentId as Id<"tournaments">,
  });

  const players = useQuery(api.players.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });

  const player = players?.find((p) => p.playerToken === playerToken);

  // ✅ Fix: only run this query once we have a valid player._id
  const matches = useQuery(
    api.matches.getByPlayer,
    player
      ? { tournamentId: tournamentId as Id<"tournaments">, playerId: player._id }
      : "skip",
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (tournament === undefined || players === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-500">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="w-10 h-10 rounded-full border-2 border-blue-500/40 border-t-blue-500"
          style={{ borderTopColor: "#3b82f6" }}
        />
        <p className="text-sm font-medium">Wczytywanie profilu…</p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (!player || !tournament) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <SmileyXEyes weight="duotone" className="w-16 h-16 text-zinc-700" />
        <h2 className="text-xl font-bold text-zinc-300">Nie znaleziono gracza</h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Upewnij się, że link jest poprawny. Jeśli problem się powtarza, skontaktuj się z
          organizatorem.
        </p>
      </div>
    );
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  let wins = 0;
  let draws = 0;
  let losses = 0;

  (matches ?? []).forEach((m) => {
    if (m.status !== "finished") return;
    const isP1 = m.player1Id === player._id;
    const myScore = isP1 ? m.player1Score! : m.player2Score!;
    const theirScore = isP1 ? m.player2Score! : m.player1Score!;
    if (myScore > theirScore) wins++;
    else if (myScore < theirScore) losses++;
    else draws++;
  });

  const played = wins + draws + losses;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <PublicHeader tournamentName={tournament.name} tournamentId={tournamentId} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-zinc-800/60">
        {/* subtle grid bg */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* blue glow blob */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
          >
            {/* Avatar */}
            <div className="relative">
              <img
                src={dicebearInitials(player.name)}
                alt={player.name}
                className="w-24 h-24 rounded-full ring-4 ring-blue-500/25 shadow-2xl"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
            </div>

            {/* Name & tournament */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">
                Karta gracza
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none truncate">
                {player.name}
              </h1>
              <p className="mt-2 text-sm text-zinc-400 flex items-center gap-1.5">
                <Trophy weight="fill" className="w-3.5 h-3.5 text-zinc-500" />
                {tournament.name}
              </p>
            </div>

            {/* Win rate badge */}
            {played > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 22 }}
                className="sm:text-right shrink-0"
              >
                <div className="inline-flex flex-col items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3">
                  <span className="text-3xl font-black text-white tracking-tight">
                    {winRate}%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">
                    Skuteczność
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Stat cards */}
          <div className="flex gap-3 mt-8">
            <StatCard
              value={wins}
              label="Wygrane"
              color="text-emerald-400"
              icon={<Trophy weight="fill" className="w-5 h-5" />}
              delay={0.05}
            />
            <StatCard
              value={draws}
              label="Remisy"
              color="text-amber-400"
              icon={<Handshake weight="fill" className="w-5 h-5" />}
              delay={0.1}
            />
            <StatCard
              value={losses}
              label="Porażki"
              color="text-rose-400"
              icon={<WarningCircle weight="fill" className="w-5 h-5" />}
              delay={0.15}
            />
          </div>
        </div>
      </div>

      {/* ── Matches ──────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2.5 mb-6">
          <CalendarBlank weight="duotone" className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">Twoje mecze</h2>
          {matches && matches.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-zinc-600 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
              {matches.length}
            </span>
          )}
        </div>

        {/* Loading matches */}
        {matches === undefined && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
                className="h-20 bg-zinc-900 rounded-2xl border border-zinc-800"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {matches !== undefined && matches.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <CalendarBlank weight="duotone" className="w-14 h-14 text-zinc-700" />
            <p className="text-zinc-400 font-medium">Brak przydzielonych meczów</p>
            <p className="text-sm text-zinc-600 max-w-xs">
              Mecze pojawią się tutaj, gdy organizator wygeneruje harmonogram.
            </p>
          </motion.div>
        )}

        {/* Match list */}
        {matches !== undefined && matches.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {matches.map((m, i) => (
              <MatchCard
                key={m._id}
                match={m as Match}
                playerId={player._id}
                players={players}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export const runtime = "edge";
