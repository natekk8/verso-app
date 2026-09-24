"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Check, X, Plus } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const updateResult = useMutation(api.matches.updateResult);
  const clearResult = useMutation(api.matches.clearResult);

  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  if (matches === undefined || players === undefined) {
    return <div className="p-8 text-zinc-500">Wczytywanie meczów...</div>;
  }

  // Filter out BYE matches (where one player is null) if we don't want to score them.
  // Actually, BYEs can just be ignored in results.
  const playableMatches = matches.filter(m => m.player1Id && m.player2Id);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Wyniki na żywo</h1>
        <p className="text-muted-foreground mt-2">
          Wprowadzaj wyniki meczów. Zmiany są od razu widoczne na ekranach graczy i kibiców.
        </p>
      </div>

      <div className="grid gap-4">
        {playableMatches.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
            Brak meczów do rozegrania. Przejdź do zakładki "Podział", aby wygenerować mecze.
          </div>
        ) : (
          playableMatches.map((m) => {
            const p1 = players.find((p) => p._id === m.player1Id);
            const p2 = players.find((p) => p._id === m.player2Id);
            const isFinished = m.status === "finished";

            return (
              <motion.div
                key={m._id}
                layout
                onClick={() => setSelectedMatch(m)}
                className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-100 ${
                  isFinished
                    ? "bg-zinc-900/50 border-zinc-800"
                    : "bg-card border-border/50 hover:border-blue-500/50 hover:bg-blue-500/5"
                }`}
              >
                <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                  <div className="w-full md:w-1/3 flex items-center justify-end gap-3 text-right">
                    <span className={`font-semibold ${isFinished && m.winnerId === p1?._id ? "text-emerald-400" : "text-zinc-100"}`}>
                      {p1?.name || "Brak"}
                    </span>
                    <img
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p1?.name || "")}&backgroundColor=2563eb,3b82f6`}
                      className="w-10 h-10 rounded-xl"
                    />
                  </div>

                  <div className="px-6 py-2 rounded-xl bg-zinc-950 border border-zinc-800 font-mono font-bold text-xl min-w-[100px] text-center">
                    {isFinished ? `${m.player1Score} : ${m.player2Score}` : "VS"}
                  </div>

                  <div className="w-full md:w-1/3 flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p2?.name || "")}&backgroundColor=2563eb,3b82f6`}
                      className="w-10 h-10 rounded-xl"
                    />
                    <span className={`font-semibold ${isFinished && m.winnerId === p2?._id ? "text-emerald-400" : "text-zinc-100"}`}>
                      {p2?.name || "Brak"}
                    </span>
                  </div>
                </div>
                
                {isFinished && m.setsDetails && m.setsDetails.length > 0 && (
                  <div className="hidden md:flex gap-2 ml-4 text-xs font-mono text-zinc-500">
                    {m.setsDetails.map((set: any, i: number) => (
                      <span key={i} className="bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                        {set.p1}:{set.p2}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {selectedMatch && (
          <MatchScoreModal
            match={selectedMatch}
            players={players}
            adminToken={adminToken}
            onClose={() => setSelectedMatch(null)}
            updateResult={updateResult}
            clearResult={clearResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MatchScoreModal({ match, players, adminToken, onClose, updateResult, clearResult }: any) {
  const p1 = players.find((p: any) => p._id === match.player1Id);
  const p2 = players.find((p: any) => p._id === match.player2Id);

  const [mode, setMode] = useState<"standard" | "sets">(match.setsDetails?.length > 0 ? "sets" : "standard");
  
  // Standard mode
  const [s1, setS1] = useState(match.player1Score?.toString() || "");
  const [s2, setS2] = useState(match.player2Score?.toString() || "");

  // Sets mode
  const [sets, setSets] = useState<{p1: string; p2: string}[]>(
    match.setsDetails && match.setsDetails.length > 0
      ? match.setsDetails.map((s: any) => ({ p1: s.p1.toString(), p2: s.p2.toString() }))
      : [{ p1: "", p2: "" }]
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!adminToken) return toast.error("Brak uprawnień admina.");
    setSaving(true);

    try {
      if (mode === "standard") {
        const score1 = parseInt(s1);
        const score2 = parseInt(s2);
        if (isNaN(score1) || isNaN(score2)) {
          toast.error("Wprowadź poprawne punkty.");
          return;
        }
        await updateResult({
          id: match._id,
          adminToken,
          player1Score: score1,
          player2Score: score2,
        });
      } else {
        // Sets mode logic
        let p1SetsWon = 0;
        let p2SetsWon = 0;
        const parsedSets = sets.filter(s => s.p1 !== "" && s.p2 !== "").map(s => {
          const p1Score = parseInt(s.p1) || 0;
          const p2Score = parseInt(s.p2) || 0;
          if (p1Score > p2Score) p1SetsWon++;
          else if (p2Score > p1Score) p2SetsWon++;
          return { p1: p1Score, p2: p2Score };
        });

        if (parsedSets.length === 0) {
          toast.error("Wprowadź przynajmniej jeden set.");
          return;
        }

        // We save the sets won as the primary score, so 2-1 or 2-0 is the main score.
        await updateResult({
          id: match._id,
          adminToken,
          player1Score: p1SetsWon,
          player2Score: p2SetsWon,
          setsDetails: parsedSets
        });
      }
      toast.success("Wynik zapisany na żywo!");
      onClose();
    } catch (e) {
      toast.error("Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!adminToken) return;
    setSaving(true);
    await clearResult({ id: match._id, adminToken });
    toast.success("Wynik zresetowany");
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
        <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Wprowadź wynik</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white p-0 h-auto">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mode switch */}
          <div className="flex bg-zinc-900 rounded-lg p-1 w-full border border-zinc-800">
            <button
              onClick={() => setMode("standard")}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${mode === "standard" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Zwykły wynik
            </button>
            <button
              onClick={() => setMode("sets")}
              className={`flex-1 text-sm py-2 rounded-md transition-colors ${mode === "sets" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Punktacja w setach
            </button>
          </div>

          <div className="flex justify-between items-center text-center px-4">
            <div className="flex-1 font-semibold text-zinc-100">{p1?.name}</div>
            <div className="px-4 text-xs font-medium text-zinc-500 uppercase">VS</div>
            <div className="flex-1 font-semibold text-zinc-100">{p2?.name}</div>
          </div>

          {mode === "standard" ? (
            <div className="flex items-center justify-center gap-6">
              <Input
                type="number"
                value={s1}
                onChange={(e) => setS1(e.target.value)}
                className="w-24 h-16 text-center text-2xl font-bold bg-zinc-900 border-zinc-800 focus:border-blue-500"
                autoFocus
              />
              <span className="text-2xl font-bold text-zinc-600">:</span>
              <Input
                type="number"
                value={s2}
                onChange={(e) => setS2(e.target.value)}
                className="w-24 h-16 text-center text-2xl font-bold bg-zinc-900 border-zinc-800 focus:border-blue-500"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {sets.map((set, i) => (
                <div key={i} className="flex items-center justify-center gap-4">
                  <span className="text-xs text-zinc-500 w-12 text-right">Set {i + 1}</span>
                  <Input
                    type="number"
                    value={set.p1}
                    onChange={(e) => {
                      const n = [...sets];
                      n[i].p1 = e.target.value;
                      setSets(n);
                    }}
                    className="w-16 text-center font-mono bg-zinc-900 border-zinc-800"
                  />
                  <span className="text-zinc-600">:</span>
                  <Input
                    type="number"
                    value={set.p2}
                    onChange={(e) => {
                      const n = [...sets];
                      n[i].p2 = e.target.value;
                      setSets(n);
                    }}
                    className="w-16 text-center font-mono bg-zinc-900 border-zinc-800"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-zinc-500 hover:text-rose-400"
                    onClick={() => setSets(sets.filter((_, idx) => idx !== i))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setSets([...sets, { p1: "", p2: "" }])} className="border-zinc-800 text-zinc-400 hover:text-white">
                  <Plus className="w-4 h-4 mr-2" /> Dodaj set
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-zinc-800/50">
            {match.status === "finished" && (
              <Button variant="outline" className="border-rose-500/20 text-rose-500 hover:bg-rose-500/10" onClick={handleClear} disabled={saving}>
                Resetuj
              </Button>
            )}
            <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Zapisywanie..." : "Zapisz wynik"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const runtime = 'edge';
