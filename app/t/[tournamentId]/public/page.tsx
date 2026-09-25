"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use, useState } from "react";
import { motion } from "motion/react";
import { PublicHeader } from "@/components/layout/public-header";
import { calculateStandings } from "@/lib/tournament-logic";
import {
  Trophy,
  CalendarBlank,
  Users,
  SoccerBall,
  Clock,
  ListNumbers,
  CircleNotch,
  WarningCircle,
  PlayCircle,
  CheckCircle,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus
} from "@phosphor-icons/react";

const BracketNode = ({ match, allMatches, players }: { match: any, allMatches: any[], players: any[] }) => {
  const children = allMatches
    .filter(m => m.nextMatchId === match._id)
    .sort((a, b) => (a.nextMatchSlot || 1) - (b.nextMatchSlot || 1));

  const p1 = players.find(p => p._id === match.player1Id);
  const p2 = players.find(p => p._id === match.player2Id);
  const p1Name = p1?.name ?? "TBD";
  const p2Name = p2?.name ?? "TBD";
  
  const p1Won = (match.player1Score ?? 0) > (match.player2Score ?? 0);
  const p2Won = (match.player2Score ?? 0) > (match.player1Score ?? 0);
  const isFinished = match.status === "finished";

  return (
    <div className="flex items-center">
      {children.length > 0 && (
        <div className="flex flex-col relative justify-center">
          {children.map((child, index) => (
            <div key={child._id} className="flex items-center relative py-4">
               <BracketNode match={child} allMatches={allMatches} players={players} />
               <div className="w-8 h-px bg-zinc-700/60" />
               {children.length > 1 && index === 0 && (
                 <div className="absolute right-0 top-1/2 bottom-0 w-px bg-zinc-700/60" />
               )}
               {children.length > 1 && index === 1 && (
                 <div className="absolute right-0 top-0 bottom-1/2 w-px bg-zinc-700/60" />
               )}
            </div>
          ))}
        </div>
      )}

      {children.length > 0 && (
        <div className="w-8 h-px bg-zinc-700/60" />
      )}

      <div className="relative z-10 w-56 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/40 transition-transform hover:scale-[1.02] hover:border-zinc-700 cursor-default">
        <div className="px-3 py-1.5 bg-zinc-950/50 border-b border-zinc-800/50 flex justify-between items-center text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
          <span>{match.matchLabel || `Mecz ${match.matchNumber}`}</span>
          {match.status === "in_progress" && <span className="text-emerald-400 animate-pulse">Live</span>}
        </div>
        <div className="flex flex-col">
          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/30 ${isFinished && p1Won ? 'bg-emerald-500/10' : ''}`}>
            <span className={`text-sm truncate pr-2 ${isFinished ? (p1Won ? 'font-bold text-emerald-400' : 'text-zinc-500') : 'text-zinc-300'}`}>{p1Name}</span>
            <span className={`font-mono font-bold ${isFinished ? (p1Won ? 'text-emerald-400' : 'text-zinc-500') : 'text-zinc-600'}`}>{match.player1Score ?? '-'}</span>
          </div>
          <div className={`flex items-center justify-between px-4 py-2.5 ${isFinished && p2Won ? 'bg-emerald-500/10' : ''}`}>
            <span className={`text-sm truncate pr-2 ${isFinished ? (p2Won ? 'font-bold text-emerald-400' : 'text-zinc-500') : 'text-zinc-300'}`}>{p2Name}</span>
            <span className={`font-mono font-bold ${isFinished ? (p2Won ? 'text-emerald-400' : 'text-zinc-500') : 'text-zinc-600'}`}>{match.player2Score ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  const t = useQuery(api.tournaments.getPublic, {
    id: tournamentId as Id<"tournaments">,
  });
  
  const players = useQuery(api.players.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  
  const matches = useQuery(api.matches.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  
  const phases = useQuery(api.phases.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });

  if (t === undefined || players === undefined || matches === undefined || phases === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <CircleNotch weight="bold" className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm font-medium animate-pulse">Ładowanie turnieju...</p>
      </div>
    );
  }

  if (t === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
        >
          <WarningCircle weight="duotone" className="w-10 h-10 text-zinc-500" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold mb-3 text-zinc-100"
        >
          Nie znaleziono turnieju
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 text-center max-w-sm"
        >
          Ten turniej nie istnieje lub jego strona publiczna została wyłączona przez organizatora.
        </motion.p>
      </div>
    );
  }

  const finishedMatches = matches
    .filter(m => m.status === "finished")
    .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
    .slice(0, 5);
    
  const upcomingMatches = matches
    .filter(m => m.status === "pending" || m.status === "in_progress")
    .slice(0, 5);

  const statusMap = {
    draft: { label: "Planowany", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: CalendarBlank },
    active: { label: "Trwa", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: PlayCircle },
    finished: { label: "Zakończony", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle }
  };
  
  // Safe fallback in case status is undefined
  const statusInfo = statusMap[t.status as keyof typeof statusMap] || statusMap.draft;
  const StatusIcon = statusInfo.icon;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30 font-sans pb-24">
      <PublicHeader tournamentName={t.name} tournamentId={tournamentId} />
      
      {/* Subtle Background Glow */}
      <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none -z-10" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-12 md:mb-16 lg:mb-24"
        >
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 mb-6">
            <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-full border flex items-center gap-1.5 ${statusInfo.color}`}>
              <StatusIcon weight="bold" className="w-4 h-4" />
              {statusInfo.label}
            </div>
            {t.sport && (
              <span className="text-sm font-medium text-zinc-400 flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                <SoccerBall weight="fill" className="text-zinc-500" />
                {t.sport}
              </span>
            )}
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-4 md:mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500">
            {t.name}
          </motion.h1>
          
          {t.description && (
            <motion.p variants={itemVariants} className="text-base md:text-lg lg:text-xl text-zinc-400 max-w-3xl mb-8 md:mb-10 leading-relaxed font-light">
              {t.description}
            </motion.p>
          )}
          
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 md:gap-6 text-sm font-medium text-zinc-300 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-3 md:p-4 rounded-2xl w-fit shadow-lg shadow-black/20">
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Users weight="duotone" className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm md:text-base">{players.length} <span className="text-zinc-500">uczestników</span></span>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Trophy weight="duotone" className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-sm md:text-base">{phases.length} <span className="text-zinc-500">etapów</span></span>
            </div>
          </motion.div>
        </motion.div>

        <div className="grid xl:grid-cols-3 gap-10 xl:gap-12">
          {/* Main content - Standings */}
          <div className="xl:col-span-2 space-y-12 md:space-y-16">
            {phases.map((phase, pIndex) => {
              const phaseMatches = matches.filter(m => m.phaseId === phase._id);
              const standings = calculateStandings(
                players.map(p => p._id), 
                phaseMatches, 
                players as any,
                t.scoring.winPoints,
                t.scoring.drawPoints,
                t.scoring.lossPoints
              );
              
              return (
                <motion.div 
                  key={phase._id} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: pIndex * 0.1, duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
                  className="space-y-4 md:space-y-6"
                >
                  <div className="flex items-center gap-3 pb-3 md:pb-4 border-b border-zinc-800/80">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                      <ListNumbers weight="duotone" className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100">
                      {phase.name}
                    </h2>
                  </div>
                  
                  <div className={`bg-zinc-900/10 border border-zinc-800/40 rounded-2xl overflow-hidden ${phase.type === 'bracket' ? 'p-4 md:p-8 min-h-[400px] md:min-h-[500px] flex items-center justify-center relative overflow-auto hide-scrollbar' : ''}`}>
                    {phase.type === 'bracket' ? (
                      <div 
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease-out' }}
                        className="flex items-center justify-center min-w-max"
                      >
                        {phaseMatches.filter(m => !m.nextMatchId).map(f => (
                          <BracketNode key={f._id} match={f} allMatches={phaseMatches} players={players} />
                        ))}
                        {phaseMatches.filter(m => !m.nextMatchId).length === 0 && (
                          <div className="text-zinc-500 font-medium">Brak meczów w drabince</div>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-sm text-left">
                        <thead className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider bg-zinc-900/20 text-zinc-500 border-b border-zinc-800/40">
                          <tr>
                            <th className="px-3 py-3 md:px-5 md:py-4 w-10 md:w-12 text-center">#</th>
                            <th className="px-3 py-3 md:px-5 md:py-4">Uczestnik</th>
                            <th className="px-2 py-3 md:px-4 md:py-4 text-center hidden md:table-cell" title="Rozegrane Mecze">M</th>
                            <th className="px-2 py-3 md:px-4 md:py-4 text-center text-emerald-500/70 hidden sm:table-cell" title="Wygrane">W</th>
                            <th className="px-2 py-3 md:px-4 md:py-4 text-center text-amber-500/70 hidden sm:table-cell" title="Remisy">R</th>
                            <th className="px-2 py-3 md:px-4 md:py-4 text-center text-rose-500/70 hidden sm:table-cell" title="Przegrane">P</th>
                            <th className="px-2 py-3 md:px-4 md:py-4 text-center hidden sm:table-cell" title="Bramki/Punkty zdobyte : stracone">+/-</th>
                            <th className="px-3 py-3 md:px-5 md:py-4 text-center text-blue-400" title="Punkty w tabeli">PKT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {standings.map((row, i) => (
                            <tr key={row.playerId} className="hover:bg-zinc-800/40 transition-colors group">
                              <td className="px-3 py-3 md:px-5 md:py-4 text-center font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                {i + 1}
                              </td>
                              <td className="px-3 py-3 md:px-5 md:py-4 font-medium text-zinc-200">
                                <span className="truncate block font-semibold text-sm md:text-base">{row.playerName}</span>
                              </td>
                              <td className="px-2 py-3 md:px-4 md:py-4 text-center text-zinc-400 font-mono hidden md:table-cell">{row.played}</td>
                              <td className="px-2 py-3 md:px-4 md:py-4 text-center text-emerald-400/90 font-mono hidden sm:table-cell">{row.won}</td>
                              <td className="px-2 py-3 md:px-4 md:py-4 text-center text-amber-400/90 font-mono hidden sm:table-cell">{row.drawn}</td>
                              <td className="px-2 py-3 md:px-4 md:py-4 text-center text-rose-400/90 font-mono hidden sm:table-cell">{row.lost}</td>
                              <td className="px-2 py-3 md:px-4 md:py-4 text-center text-zinc-500 font-mono text-xs tracking-wider hidden sm:table-cell">
                                {row.goalsFor}<span className="text-zinc-700 mx-1">:</span>{row.goalsAgainst}
                              </td>
                              <td className="px-3 py-3 md:px-5 md:py-4 text-center font-black text-blue-400 text-sm md:text-base bg-blue-500/5 border-l border-zinc-800/50">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                          
                          {standings.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-5 py-12 text-center text-zinc-500 text-sm">
                                Brak uczestników w tym etapie
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Sidebar - Recent & Upcoming */}
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="bg-zinc-900/10 border border-zinc-800/40 rounded-2xl p-6 relative overflow-hidden"
            >
              
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-zinc-100">
                <Clock weight="duotone" className="w-6 h-6 text-emerald-500" />
                Ostatnie wyniki
              </h3>
              
              <div className="space-y-3 relative z-10">
                {finishedMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800">
                    <SoccerBall weight="duotone" className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-500">Brak zakończonych meczów</p>
                  </div>
                ) : (
                  finishedMatches.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "Wolny los";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "Wolny los";
                    const p1Won = (m.player1Score ?? 0) > (m.player2Score ?? 0);
                    const p2Won = (m.player2Score ?? 0) > (m.player1Score ?? 0);
                    const isDraw = (m.player1Score ?? 0) === (m.player2Score ?? 0);

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1) }}
                        key={m._id} 
                        className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors"
                      >
                        <div className={`flex-1 text-right text-sm truncate pr-3 ${p1Won ? 'font-bold text-zinc-100' : 'font-medium text-zinc-400'}`}>
                          {p1}
                        </div>
                        <div className={`shrink-0 font-black font-mono px-4 py-1.5 bg-zinc-900 rounded-xl border border-zinc-800 shadow-inner ${isDraw ? 'text-zinc-400' : 'text-blue-400'}`}>
                          {m.player1Score} <span className="text-zinc-600 font-sans font-normal mx-0.5">-</span> {m.player2Score}
                        </div>
                        <div className={`flex-1 text-left text-sm truncate pl-3 ${p2Won ? 'font-bold text-zinc-100' : 'font-medium text-zinc-400'}`}>
                          {p2}
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="bg-zinc-900/10 border border-zinc-800/40 rounded-2xl p-6 relative overflow-hidden"
            >
              
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-zinc-100">
                <CalendarBlank weight="duotone" className="w-6 h-6 text-blue-500" />
                Nadchodzące
              </h3>
              
              <div className="space-y-3 relative z-10">
                {upcomingMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800">
                    <CalendarBlank weight="duotone" className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-500">Brak zaplanowanych meczów</p>
                  </div>
                ) : (
                  upcomingMatches.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "Wolny los";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "Wolny los";
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + (i * 0.1) }}
                        key={m._id} 
                        className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 group hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3 text-xs font-medium uppercase tracking-wider">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <ListNumbers weight="bold" className="w-3.5 h-3.5" />
                            {m.matchLabel || `Mecz ${m.matchNumber}`}
                          </span>
                          {m.scheduledTime && (
                            <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              {m.scheduledTime}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between font-semibold text-zinc-200">
                          <span className="truncate flex-1 text-right">{p1}</span>
                          <span className="text-zinc-600 mx-3 text-[10px] font-black uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">VS</span>
                          <span className="truncate flex-1 text-left">{p2}</span>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      
      {/* Floating Presentation Control Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-2 rounded-full shadow-2xl z-50">
        <button onClick={handleZoomOut} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors" title="Oddal (Zoom Out)">
          <MagnifyingGlassMinus weight="bold" className="w-5 h-5" />
        </button>
        <button onClick={handleZoomReset} className="px-3 text-xs font-mono font-bold text-zinc-300 hover:text-zinc-100 transition-colors" title="Zresetuj przybliżenie">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={handleZoomIn} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors" title="Przybliż (Zoom In)">
          <MagnifyingGlassPlus weight="bold" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export const runtime = "edge";
