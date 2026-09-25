"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CalendarBlank, Clock, Plus, Trash } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SchedulePage({
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

  const updateSchedule = useMutation(api.matches.updateSchedule);
  
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  if (matches === undefined || players === undefined) {
    return <div className="p-8 text-zinc-500">Wczytywanie harmonogramu...</div>;
  }

  // Group matches by round (kolejka)
  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Harmonogram</h1>
        <p className="text-muted-foreground mt-2">
          Zarządzaj terminami meczów. Kliknij na mecz, aby przypisać mu datę i godzinę.
        </p>
      </div>

      {rounds.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
          Brak meczów. Wygeneruj mecze w zakładce "Podział".
        </div>
      ) : (
        <div className="space-y-12">
          {rounds.map(round => {
            const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.matchNumber - b.matchNumber);
            return (
              <div key={round} className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CalendarBlank className="text-blue-500 w-6 h-6" /> Kolejka {round}
                </h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {roundMatches.map(m => {
                    const p1 = players.find(p => p._id === m.player1Id);
                    const p2 = players.find(p => p._id === m.player2Id);
                    const hasSchedule = m.scheduledDayId || m.scheduledTime;

                    return (
                      <div 
                        key={m._id} 
                        onClick={() => setSelectedMatch(m)}
                        className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:bg-zinc-800 hover:border-zinc-700 transition-all"
                      >
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-500 font-medium">Mecz {m.matchNumber}</span>
                          {hasSchedule ? (
                            <span className="text-blue-400 flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-md text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" /> 
                              {m.scheduledDayId} {m.scheduledTime && `• ${m.scheduledTime}`}
                            </span>
                          ) : (
                            <span className="text-zinc-600 flex items-center gap-1 text-xs">
                              <Clock className="w-3.5 h-3.5" /> Brak terminu
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="font-semibold truncate">{p1?.name || "Brak"}</span>
                          <span className="text-zinc-600 text-xs px-2">VS</span>
                          <span className="font-semibold truncate text-right">{p2?.name || "Brak"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedMatch && (
        <ScheduleModal 
          match={selectedMatch}
          adminToken={adminToken}
          onClose={() => setSelectedMatch(null)}
          updateSchedule={updateSchedule}
        />
      )}
    </div>
  );
}

function ScheduleModal({ match, adminToken, onClose, updateSchedule }: any) {
  const [date, setDate] = useState(match.scheduledDayId || "");
  const [time, setTime] = useState(match.scheduledTime || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!adminToken) return toast.error("Brak uprawnień");
    setSaving(true);
    try {
      await updateSchedule({
        id: match._id,
        adminToken,
        scheduledDayId: date || undefined,
        scheduledTime: time || undefined
      });
      toast.success("Termin zapisany");
      onClose();
    } catch (e) {
      toast.error("Błąd zapisywania");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Ustal termin meczu {match.matchNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Data (np. 2026-10-15)</label>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="bg-zinc-900 border-zinc-800"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Godzina (np. 14:30)</label>
            <Input 
              type="time" 
              value={time} 
              onChange={e => setTime(e.target.value)} 
              className="bg-zinc-900 border-zinc-800"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white" onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const runtime = 'edge';
