"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use, useEffect, useState } from "react";
import { getAdminToken } from "@/lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { SoccerBall, Clock, Trophy, MapPin } from "@phosphor-icons/react";
import { calculateStandings } from "@/lib/tournament-logic";

export default function PresentationPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId));
  }, [tournamentId]);

  const t = useQuery(api.tournaments.get, { id: tournamentId as Id<"tournaments"> });
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const matches = useQuery(api.matches.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const phases = useQuery(api.phases.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });

  // Auto-rotation logic
  const [currentView, setCurrentView] = useState<"live" | "standings">("live");
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

  useEffect(() => {
    if (!phases || phases.length === 0) return;
    const interval = setInterval(() => {
      setCurrentView(prev => prev === "live" ? "standings" : "live");
      if (currentView === "standings") {
        setCurrentPhaseIndex(prev => (prev + 1) % phases.length);
      }
    }, 15000); // rotate every 15s
    return () => clearInterval(interval);
  }, [phases, currentView]);

  if (t === undefined || players === undefined || matches === undefined || phases === undefined) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Wczytywanie prezentacji...</div>;
  }

  if (!t || t.adminToken !== adminToken) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-rose-500">Brak dostępu lub turniej nie istnieje</div>;
  }

  const inProgress = matches.filter(m => m.status === "in_progress");
  const recentlyFinished = matches.filter(m => m.status === "finished")
    .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
    .slice(0, 4);
  const upNext = matches.filter(m => m.status === "pending").slice(0, 4);

  const phase = phases[currentPhaseIndex];

  return (
    <div className="min-h-screen bg-black text-zinc-50 overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="p-8 border-b border-zinc-900/50 bg-zinc-950/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.3)]">
            <SoccerBall weight="fill" className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-6xl font-black tracking-tight">{t.name}</h1>
            <div className="text-2xl text-blue-400 mt-2 font-medium tracking-wide">
              {currentView === "live" ? "WYNIKI NA ŻYWO" : `TABELA - ${phase?.name?.toUpperCase()}`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold text-zinc-300">
            {new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-xl text-zinc-500 mt-2 font-medium">VERSO LIVE</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative p-12 overflow-hidden flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {currentView === "live" && (
            <motion.div 
              key="live"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-2 gap-12 h-full"
            >
              {/* Left Column: Live / Recent */}
              <div className="space-y-8 flex flex-col justify-center">
                <h2 className="text-4xl font-bold text-zinc-400 flex items-center gap-4 mb-6">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                  OSTATNIE WYNIKI
                </h2>
                
                <div className="space-y-6">
                  {recentlyFinished.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        key={m._id} 
                        className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-2xl"
                      >
                        <div className="flex-1 text-right text-4xl font-medium text-zinc-200 truncate pr-8">{p1}</div>
                        <div className="shrink-0 font-black font-mono text-5xl px-8 py-4 bg-zinc-950 rounded-2xl text-emerald-400 border border-zinc-800/80 shadow-inner">
                          {m.player1Score} <span className="text-zinc-700 mx-2">-</span> {m.player2Score}
                        </div>
                        <div className="flex-1 text-left text-4xl font-medium text-zinc-200 truncate pl-8">{p2}</div>
                      </motion.div>
                    )
                  })}
                  {recentlyFinished.length === 0 && (
                    <div className="text-3xl text-zinc-600 font-medium py-12">Oczekiwanie na pierwsze wyniki...</div>
                  )}
                </div>
              </div>

              {/* Right Column: Up next */}
              <div className="space-y-8 flex flex-col justify-center">
                <h2 className="text-4xl font-bold text-zinc-400 flex items-center gap-4 mb-6">
                  <Clock weight="bold" className="text-blue-500" />
                  NADCHODZĄCE
                </h2>
                
                <div className="space-y-6">
                  {upNext.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        key={m._id} 
                        className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 shadow-xl"
                      >
                        <div className="flex items-center justify-between mb-4 text-2xl text-zinc-500 font-medium">
                          <span>{m.matchLabel || `Mecz ${m.matchNumber}`}</span>
                          {m.scheduledTime && <span className="text-blue-400/80 bg-blue-500/10 px-4 py-1 rounded-lg">{m.scheduledTime}</span>}
                        </div>
                        <div className="flex items-center justify-between text-3xl font-medium">
                          <span className="truncate flex-1 text-right text-zinc-300 pr-6">{p1}</span>
                          <span className="text-zinc-700 font-bold">VS</span>
                          <span className="truncate flex-1 text-left text-zinc-300 pl-6">{p2}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                  {upNext.length === 0 && (
                    <div className="text-3xl text-zinc-600 font-medium py-12">Brak zaplanowanych spotkań</div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentView === "standings" && phase && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full flex flex-col justify-center max-w-6xl mx-auto w-full"
            >
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-sm">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950/80 text-zinc-500 text-2xl font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-8 py-6 w-24 text-center">#</th>
                      <th className="px-8 py-6">Uczestnik</th>
                      <th className="px-6 py-6 text-center">M</th>
                      <th className="px-6 py-6 text-center text-emerald-500/80">W</th>
                      <th className="px-6 py-6 text-center text-amber-500/80">R</th>
                      <th className="px-6 py-6 text-center text-rose-500/80">P</th>
                      <th className="px-6 py-6 text-center">+/-</th>
                      <th className="px-8 py-6 text-center text-blue-400">PKT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-3xl font-medium">
                    {calculateStandings(
                      players.map(p => p._id), 
                      matches.filter(m => m.phaseId === phase._id), 
                      players as any,
                      t.scoring.winPoints,
                      t.scoring.drawPoints,
                      t.scoring.lossPoints
                    ).map((row, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={row.playerId} 
                        className={i < 4 ? "bg-blue-500/5" : ""}
                      >
                        <td className="px-8 py-6 text-center font-mono text-zinc-500">{i + 1}</td>
                        <td className="px-8 py-6 text-zinc-200">{row.playerName}</td>
                        <td className="px-6 py-6 text-center text-zinc-500 font-mono">{row.played}</td>
                        <td className="px-6 py-6 text-center text-emerald-400 font-mono">{row.won}</td>
                        <td className="px-6 py-6 text-center text-amber-400 font-mono">{row.drawn}</td>
                        <td className="px-6 py-6 text-center text-rose-400 font-mono">{row.lost}</td>
                        <td className="px-6 py-6 text-center text-zinc-600 font-mono text-2xl">
                          {row.goalsFor}:{row.goalsAgainst}
                        </td>
                        <td className="px-8 py-6 text-center font-bold text-blue-400 font-mono text-4xl">{row.points}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

export const runtime = "edge";
