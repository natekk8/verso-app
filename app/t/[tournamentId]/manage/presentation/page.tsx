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
    const timer = setTimeout(() => {
      if (currentView === "live") {
        setCurrentView("standings");
        setCurrentPhaseIndex(0);
      } else {
        if (currentPhaseIndex < phases.length - 1) {
          setCurrentPhaseIndex(prev => prev + 1);
        } else {
          setCurrentView("live");
          setCurrentPhaseIndex(0);
        }
      }
    }, 15000); // rotate every 15s
    return () => clearTimeout(timer);
  }, [phases, currentView, currentPhaseIndex]);

  const [time, setTime] = useState("");
  useEffect(() => {
    setTime(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (t === undefined || players === undefined || matches === undefined || phases === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 flex items-center justify-center animate-pulse mb-8">
          <SoccerBall weight="fill" className="w-8 h-8 text-blue-500 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div className="text-zinc-500 text-2xl font-medium tracking-widest uppercase">Wczytywanie prezentacji...</div>
      </div>
    );
  }

  if (!t || t.adminToken !== adminToken) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-4xl text-rose-500 font-bold">Brak dostępu lub turniej nie istnieje</div>;
  }

  const recentlyFinished = matches.filter(m => m.status === "finished")
    .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
    .slice(0, 4);
  const upNext = matches.filter(m => m.status === "pending" || m.status === "in_progress")
    .sort((a, b) => {
      // In progress first
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      return 0;
    })
    .slice(0, 4);

  const phase = phases[currentPhaseIndex];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 overflow-hidden flex flex-col font-sans relative selection:bg-blue-500/30">
      {/* Background Gradients & Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />

      {/* Header */}
      <header className="p-10 border-b border-zinc-900/80 bg-zinc-950/60 backdrop-blur-xl flex items-center justify-between shrink-0 relative z-10 shadow-2xl">
        <div className="flex items-center gap-8">
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.4)] ring-1 ring-blue-400/30">
            <SoccerBall weight="fill" className="w-14 h-14 text-white drop-shadow-lg" />
          </div>
          <div>
            <h1 className="text-7xl font-black tracking-tight text-white drop-shadow-md">{t.name}</h1>
            <div className="text-3xl text-blue-400 mt-3 font-semibold tracking-widest uppercase flex items-center gap-3">
              {currentView === "live" ? (
                <>
                  <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                  WYNIKI NA ŻYWO
                </>
              ) : (
                <>
                  <Trophy weight="fill" className="text-amber-400" />
                  TABELA - {phase?.name}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-6xl font-mono font-bold text-white drop-shadow-lg tabular-nums tracking-tighter">
            {time}
          </div>
          <div className="text-2xl text-blue-500 mt-2 font-black tracking-[0.3em] bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20">
            VERSO LIVE
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative p-16 overflow-hidden flex flex-col justify-center z-10">
        <AnimatePresence mode="wait">
          
          {currentView === "live" && (
            <motion.div 
              key="live"
              initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -40, filter: "blur(10px)" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-2 gap-16 h-full max-w-[120rem] mx-auto w-full"
            >
              {/* Left Column: Recent / Live */}
              <div className="space-y-10 flex flex-col justify-center">
                <h2 className="text-5xl font-black text-white/90 flex items-center gap-5 mb-8 tracking-tight drop-shadow-md">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                  OSTATNIE WYNIKI
                </h2>
                
                <div className="space-y-8">
                  {recentlyFinished.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15, duration: 0.7, ease: "easeOut" }}
                        key={m._id} 
                        className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-[2.5rem] p-8 flex items-center justify-between shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div className="flex-1 text-right text-5xl font-bold text-zinc-100 truncate pr-10 z-10 drop-shadow">{p1}</div>
                        <div className="shrink-0 font-black font-mono text-7xl px-10 py-5 bg-zinc-950/80 rounded-3xl text-emerald-400 border border-emerald-500/20 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5),0_0_30px_rgba(16,185,129,0.15)] z-10 tabular-nums">
                          {m.player1Score} <span className="text-zinc-700 mx-2">-</span> {m.player2Score}
                        </div>
                        <div className="flex-1 text-left text-5xl font-bold text-zinc-100 truncate pl-10 z-10 drop-shadow">{p2}</div>
                      </motion.div>
                    )
                  })}
                  {recentlyFinished.length === 0 && (
                    <div className="text-4xl text-zinc-600 font-medium py-16 bg-zinc-900/20 rounded-[3rem] border border-zinc-800/50 flex items-center justify-center border-dashed">
                      Oczekiwanie na pierwsze wyniki...
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Up next */}
              <div className="space-y-10 flex flex-col justify-center">
                <h2 className="text-5xl font-black text-white/90 flex items-center gap-5 mb-8 tracking-tight drop-shadow-md">
                  <Clock weight="bold" className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                  NADCHODZĄCE
                </h2>
                
                <div className="space-y-8">
                  {upNext.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    const isLive = m.status === "in_progress";
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15, duration: 0.7, ease: "easeOut" }}
                        key={m._id} 
                        className={`backdrop-blur-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden ${
                          isLive 
                            ? "bg-blue-900/20 border border-blue-500/30" 
                            : "bg-zinc-900/40 border border-zinc-800/60"
                        }`}
                      >
                        {isLive && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                        )}
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-3xl text-zinc-400 font-bold uppercase tracking-wider">
                            {m.matchLabel || `Mecz ${m.matchNumber}`}
                          </span>
                          {isLive ? (
                            <span className="text-2xl text-blue-300 font-bold bg-blue-500/20 px-6 py-2 rounded-xl flex items-center gap-3 ring-1 ring-blue-400/30">
                              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
                              W TRAKCIE
                            </span>
                          ) : (
                            m.scheduledTime && (
                              <span className="text-2xl text-zinc-300 font-bold bg-zinc-800/80 px-6 py-2 rounded-xl border border-zinc-700">
                                {m.scheduledTime}
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex items-center justify-between text-5xl font-bold">
                          <span className="truncate flex-1 text-right text-white drop-shadow pr-8">{p1}</span>
                          <span className="text-zinc-600 font-black px-4">VS</span>
                          <span className="truncate flex-1 text-left text-white drop-shadow pl-8">{p2}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                  {upNext.length === 0 && (
                    <div className="text-4xl text-zinc-600 font-medium py-16 bg-zinc-900/20 rounded-[3rem] border border-zinc-800/50 flex items-center justify-center border-dashed">
                      Brak zaplanowanych spotkań
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentView === "standings" && phase && (
            <motion.div
              key={`standings-${phase._id}`}
              initial={{ opacity: 0, scale: 0.95, filter: "blur(15px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.02, filter: "blur(15px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full flex flex-col justify-center max-w-[100rem] mx-auto w-full"
            >
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-[3rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl relative">
                {/* Table Header Glow */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />
                
                <table className="w-full text-left border-collapse">
                  <thead className="bg-zinc-950/90 text-zinc-400 text-3xl font-black uppercase tracking-widest border-b-2 border-zinc-800">
                    <tr>
                      <th className="px-10 py-8 w-32 text-center">#</th>
                      <th className="px-10 py-8">Uczestnik</th>
                      <th className="px-8 py-8 text-center w-32" title="Mecze">M</th>
                      <th className="px-8 py-8 text-center w-32 text-emerald-500/80" title="Wygrane">W</th>
                      <th className="px-8 py-8 text-center w-32 text-amber-500/80" title="Remisy">R</th>
                      <th className="px-8 py-8 text-center w-32 text-rose-500/80" title="Przegrane">P</th>
                      <th className="px-8 py-8 text-center w-48">+/-</th>
                      <th className="px-12 py-8 text-center text-blue-400 w-48">PKT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-4xl font-semibold bg-zinc-950/20">
                    {calculateStandings(
                      players.map(p => p._id), 
                      matches.filter(m => m.phaseId === phase._id), 
                      players as any,
                      t.scoring.winPoints,
                      t.scoring.drawPoints,
                      t.scoring.lossPoints
                    ).map((row, i) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        key={row.playerId} 
                        className={`transition-colors hover:bg-zinc-800/30 ${i < 4 ? "bg-blue-900/10 relative" : ""}`}
                      >
                        {i < 4 && (
                          <td className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                        )}
                        <td className="px-10 py-8 text-center font-black text-zinc-500 tabular-nums">
                          {i === 0 ? <span className="text-amber-400 drop-shadow-md">1</span> : i + 1}
                        </td>
                        <td className="px-10 py-8 text-zinc-100 font-bold drop-shadow">{row.playerName}</td>
                        <td className="px-8 py-8 text-center text-zinc-400 font-mono tabular-nums">{row.played}</td>
                        <td className="px-8 py-8 text-center text-emerald-400 font-mono tabular-nums">{row.won}</td>
                        <td className="px-8 py-8 text-center text-amber-400 font-mono tabular-nums">{row.drawn}</td>
                        <td className="px-8 py-8 text-center text-rose-400 font-mono tabular-nums">{row.lost}</td>
                        <td className="px-8 py-8 text-center text-zinc-500 font-mono text-3xl tabular-nums tracking-wider">
                          <span className="text-zinc-300">{row.goalsFor}</span>:<span className="text-zinc-500">{row.goalsAgainst}</span>
                        </td>
                        <td className="px-12 py-8 text-center font-black text-blue-400 font-mono text-5xl tabular-nums drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                          {row.points}
                        </td>
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
