"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Check, X, Plus, Minus, PlayCircle, StopCircle } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId));
  }, [tournamentId]);

  const matches = useQuery(api.matches.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  const players = useQuery(api.players.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  const phases = useQuery(api.phases.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });

  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  if (matches === undefined || players === undefined || phases === undefined) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="h-10 bg-zinc-900 rounded w-1/3"></div>
        <div className="h-32 bg-zinc-900 rounded"></div>
      </div>
    );
  }

  const playableMatches = matches.filter(m => m.player1Id && m.player2Id);

  // Group by phase and then by round
  const grouped: Record<string, Record<number, typeof playableMatches>> = {};
  playableMatches.forEach(m => {
    if (!grouped[m.phaseId]) grouped[m.phaseId] = {};
    if (!grouped[m.phaseId][m.round]) grouped[m.phaseId][m.round] = [];
    grouped[m.phaseId][m.round].push(m);
  });

  // Sort phases by order
  const sortedPhases = phases.sort((a, b) => a.order - b.order);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Wyniki na żywo</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-lg">
          Zarządzaj wynikami meczów. Transmituj punkty set po secie bezpośrednio na ekran publiczny.
        </p>
      </div>

      {playableMatches.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-zinc-300 mb-2">Brak meczów do rozegrania</h3>
          <p>Przejdź do zakładki "Podział", aby wygenerować mecze i harmonogram.</p>
        </div>
      ) : (
        <div className="space-y-16">
          {sortedPhases.map(phase => {
            const rounds = grouped[phase._id];
            if (!rounds) return null;

            return (
              <section key={phase._id} className="space-y-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-zinc-100">{phase.name}</h2>
                  <div className="h-px bg-zinc-800 flex-1"></div>
                </div>

                <div className="space-y-12">
                  {Object.entries(rounds)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([roundNum, roundMatches]) => (
                      <div key={roundNum} className="space-y-4">
                        <h3 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                          Kolejka {roundNum}
                        </h3>
                        <div className="grid gap-3">
                          {roundMatches.map(m => {
                            const p1 = players.find(p => p._id === m.player1Id);
                            const p2 = players.find(p => p._id === m.player2Id);
                            const isLive = m.status === "in_progress";
                            const isFinished = m.status === "finished";

                            return (
                              <motion.button
                                key={m._id}
                                layout
                                onClick={() => setSelectedMatch(m)}
                                className={cn(
                                  "w-full flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                                  isLive 
                                    ? "bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]" 
                                    : isFinished
                                      ? "bg-zinc-900/40 border-zinc-800/80"
                                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                                )}
                              >
                                <div className="flex-1 flex flex-col md:flex-row items-center w-full gap-4 md:gap-6">
                                  {/* P1 */}
                                  <div className="w-full md:w-2/5 flex items-center justify-end gap-3 text-right">
                                    <span className={cn(
                                      "font-semibold text-lg truncate", 
                                      isFinished && m.winnerId === p1?._id ? "text-white" : isFinished ? "text-zinc-500" : "text-zinc-200"
                                    )}>
                                      {p1?.name || "Brak"}
                                    </span>
                                  </div>

                                  {/* Score Box */}
                                  <div className={cn(
                                    "px-6 py-2 rounded-xl border font-mono font-bold text-xl min-w-[120px] text-center flex-shrink-0 flex flex-col items-center justify-center gap-1",
                                    isLive ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : 
                                    isFinished ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-950 border-zinc-800 text-zinc-500"
                                  )}>
                                    {(isFinished || isLive) ? (
                                      <span>{m.player1Score || 0} : {m.player2Score || 0}</span>
                                    ) : (
                                      <span className="text-sm uppercase tracking-widest text-zinc-600">VS</span>
                                    )}
                                    {isLive && (
                                      <span className="text-[9px] uppercase tracking-widest flex items-center gap-1 opacity-90">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                                      </span>
                                    )}
                                  </div>

                                  {/* P2 */}
                                  <div className="w-full md:w-2/5 flex items-center gap-3">
                                    <span className={cn(
                                      "font-semibold text-lg truncate", 
                                      isFinished && m.winnerId === p2?._id ? "text-white" : isFinished ? "text-zinc-500" : "text-zinc-200"
                                    )}>
                                      {p2?.name || "Brak"}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Sets breakdown */}
                                {(isFinished || isLive) && m.setsDetails && m.setsDetails.length > 0 && (
                                  <div className="mt-4 md:mt-0 md:ml-6 flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar max-w-full">
                                    {m.setsDetails.map((set: any, i: number) => (
                                      <div key={i} className={cn(
                                        "px-2 py-1 rounded-md text-xs font-mono font-medium whitespace-nowrap",
                                        isLive ? "bg-blue-500/20 text-blue-200 border border-blue-500/30" : "bg-zinc-800/50 text-zinc-400 border border-zinc-800"
                                      )}>
                                        S{i+1} {set.p1}:{set.p2}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <LiveMatchModal
        isOpen={!!selectedMatch}
        match={selectedMatch}
        players={players}
        adminToken={adminToken}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}

function LiveMatchModal({ isOpen, match, players, adminToken, onClose }: any) {
  // We must handle match == null gracefully so Dialog can exit animation doesn't crash
  const safeMatch = match || { _id: "", player1Id: "", player2Id: "", status: "pending", player1Score: 0, player2Score: 0, setsDetails: [] };
  
  const p1 = players?.find((p: any) => p._id === safeMatch.player1Id);
  const p2 = players?.find((p: any) => p._id === safeMatch.player2Id);

  const startMatch = useMutation(api.matches.startMatch);
  const endMatch = useMutation(api.matches.endMatch);
  const updateLiveScore = useMutation(api.matches.updateLiveScore);
  const clearResult = useMutation(api.matches.clearResult);

  const isLive = safeMatch.status === "in_progress";
  const isFinished = safeMatch.status === "finished";

  // Use local state for immediate feedback, but sync with match prop
  const [localSets, setLocalSets] = useState<{p1: number, p2: number}[]>(safeMatch.setsDetails || []);
  
  useEffect(() => {
    if (match) {
      setLocalSets(match.setsDetails || []);
    }
  }, [match]);

  const p1SetsWon = localSets.filter(s => s.p1 > s.p2).length;
  const p2SetsWon = localSets.filter(s => s.p2 > s.p1).length;

  const handleStartLive = async () => {
    if (!adminToken) return;
    triggerHaptic("heavy");
    if (localSets.length === 0) {
      setLocalSets([{ p1: 0, p2: 0 }]); // Add first set automatically
      await updateLiveScore({ id: safeMatch._id, adminToken, currentSetIndex: 0, setPlayer1Score: 0, setPlayer2Score: 0 });
    }
    await startMatch({ id: safeMatch._id, adminToken });
  };

  const handleEndMatch = async () => {
    if (!adminToken) return;
    triggerHaptic("success");
    await endMatch({ id: safeMatch._id, adminToken });
  };

  const updateSetPoint = async (setIndex: number, player: 1 | 2, delta: number) => {
    if (!adminToken) return;
    
    // Haptics
    if (delta > 0) {
      triggerHaptic("medium");
    } else {
      triggerHaptic("light");
    }

    const newSets = [...localSets];
    if (!newSets[setIndex]) newSets[setIndex] = { p1: 0, p2: 0 };
    
    if (player === 1) newSets[setIndex].p1 = Math.max(0, newSets[setIndex].p1 + delta);
    else newSets[setIndex].p2 = Math.max(0, newSets[setIndex].p2 + delta);
    
    setLocalSets(newSets);
    await updateLiveScore({ 
      id: safeMatch._id, 
      adminToken, 
      currentSetIndex: setIndex, 
      setPlayer1Score: newSets[setIndex].p1, 
      setPlayer2Score: newSets[setIndex].p2 
    });
  };

  const addSet = async () => {
    if (!adminToken) return;
    const newIndex = localSets.length;
    const newSets = [...localSets, { p1: 0, p2: 0 }];
    setLocalSets(newSets);
    await updateLiveScore({ id: safeMatch._id, adminToken, currentSetIndex: newIndex, setPlayer1Score: 0, setPlayer2Score: 0 });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 p-0 overflow-hidden shadow-2xl">
        <div className={cn(
          "px-4 md:px-6 py-4 flex items-center justify-between border-b transition-colors",
          isLive ? "bg-blue-600 border-blue-500" : "bg-zinc-900 border-zinc-800"
        )}>
          <div className="flex items-center gap-3">
            {isLive ? (
              <span className="flex items-center gap-2 text-white font-bold tracking-wide text-sm md:text-base">
                <span className="relative flex h-2.5 w-2.5 md:h-3 md:w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-white"></span>
                </span>
                LIVE
              </span>
            ) : (
              <h2 className="font-semibold text-base md:text-lg text-zinc-100">Zarządzanie meczem</h2>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={cn(
            "p-0 h-auto hover:bg-transparent",
            isLive ? "text-blue-200 hover:text-white" : "text-zinc-400 hover:text-white"
          )}>
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>

        <div className="p-4 md:p-8 max-h-[85vh] overflow-y-auto hide-scrollbar">
          {/* Main Score Board */}
          <div className="flex flex-row justify-between items-center md:items-stretch gap-2 md:gap-6 mb-8 md:mb-10">
            <div className="flex-1 flex flex-col items-center gap-2 md:gap-4 overflow-hidden w-full">
              <span className="text-lg md:text-2xl font-bold text-zinc-100 truncate w-full text-center">{p1?.name || "Brak"}</span>
              <div className={cn(
                "w-20 h-20 md:w-32 md:h-32 flex items-center justify-center rounded-2xl md:rounded-3xl text-4xl md:text-6xl font-mono font-bold border transition-colors",
                isLive ? "bg-zinc-900 border-zinc-800 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-500"
              )}>
                {isLive || isFinished ? p1SetsWon : (safeMatch.player1Score ?? 0)}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1 md:gap-2 text-zinc-600 uppercase font-bold tracking-widest text-xs md:text-base md:pt-10">
              VS
            </div>

            <div className="flex-1 flex flex-col items-center gap-2 md:gap-4 overflow-hidden w-full">
              <span className="text-lg md:text-2xl font-bold text-zinc-100 truncate w-full text-center">{p2?.name || "Brak"}</span>
              <div className={cn(
                "w-20 h-20 md:w-32 md:h-32 flex items-center justify-center rounded-2xl md:rounded-3xl text-4xl md:text-6xl font-mono font-bold border transition-colors",
                isLive ? "bg-zinc-900 border-zinc-800 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-500"
              )}>
                {isLive || isFinished ? p2SetsWon : (safeMatch.player2Score ?? 0)}
              </div>
            </div>
          </div>

          {/* Sets Editor */}
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs md:text-sm font-semibold tracking-widest text-zinc-500 uppercase">Sety</h3>
              {adminToken && (isLive || isFinished) && (
                <Button variant="ghost" size="sm" onClick={addSet} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 md:h-9 text-xs md:text-sm">
                  <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" /> Nowy set
                </Button>
              )}
            </div>

            {localSets.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-sm bg-zinc-900/50 rounded-xl border border-zinc-800">
                Brak zapisanych setów. Rozpocznij mecz lub dodaj set ręcznie.
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {localSets.map((set, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-2 md:p-3 rounded-xl md:rounded-2xl transition-all">
                    {/* P1 Controls */}
                    <div className="flex items-center gap-1 md:gap-3">
                      {adminToken && (isLive || isFinished) && (
                        <>
                          <Button variant="outline" size="icon" onClick={() => updateSetPoint(i, 1, -1)} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-transform active:scale-95 shrink-0">
                            <Minus className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => updateSetPoint(i, 1, 1)} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-transform active:scale-95 shrink-0">
                            <Plus className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                    
                    {/* Set Score */}
                    <div className="flex items-center gap-3 md:gap-4 min-w-[90px] md:min-w-[120px] justify-center">
                      <span className={cn("text-2xl md:text-3xl font-mono font-bold transition-colors", set.p1 > set.p2 ? "text-white" : "text-zinc-400")}>{set.p1}</span>
                      <span className="text-zinc-600 text-xs md:text-sm font-medium">S{i+1}</span>
                      <span className={cn("text-2xl md:text-3xl font-mono font-bold transition-colors", set.p2 > set.p1 ? "text-white" : "text-zinc-400")}>{set.p2}</span>
                    </div>

                    {/* P2 Controls */}
                    <div className="flex items-center gap-1 md:gap-3">
                      {adminToken && (isLive || isFinished) && (
                        <>
                          <Button variant="outline" size="icon" onClick={() => updateSetPoint(i, 2, 1)} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-transform active:scale-95 shrink-0">
                            <Plus className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => updateSetPoint(i, 2, -1)} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-transform active:scale-95 shrink-0">
                            <Minus className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Bar */}
          {adminToken && (
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 md:gap-4 pt-4 md:pt-6 border-t border-zinc-800">
              {!isLive && !isFinished && (
                <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-12 text-sm md:text-base font-semibold transition-transform active:scale-95" onClick={handleStartLive}>
                  <PlayCircle className="w-5 h-5 mr-2" weight="fill" /> Rozpocznij Live
                </Button>
              )}
              {isLive && (
                <Button className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 h-12 text-sm md:text-base font-semibold transition-transform active:scale-95" onClick={handleEndMatch}>
                  <StopCircle className="w-5 h-5 mr-2" weight="fill" /> Zakończ Mecz
                </Button>
              )}
              {isFinished && (
                <Button variant="outline" className="flex-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 h-12 text-sm md:text-base font-semibold transition-transform active:scale-95" onClick={() => clearResult({ id: safeMatch._id, adminToken })}>
                  Cofnij Zakończenie
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const runtime = 'edge';
