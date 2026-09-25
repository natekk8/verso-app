"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, UserPlus, Link as LinkIcon, Trash, Copy, CheckCircle, Plus } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";

export default function PlayersPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId) || "");
  }, [tournamentId]);

  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const addPlayer = useMutation(api.players.add);
  const addBulkPlayers = useMutation(api.players.addBulk);
  const removePlayer = useMutation(api.players.remove);

  const [newName, setNewName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !adminToken) return;
    try {
      await addPlayer({
        tournamentId: tournamentId as Id<"tournaments">,
        adminToken: adminToken,
        name: newName.trim()
      });
      setNewName("");
      toast.success(`Dodano: ${newName.trim()}`);
    } catch (e) {
      toast.error("Błąd dodawania");
    }
  };

  const handleAddBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNames.trim() || !adminToken) return;
    const names = bulkNames.split("\n").map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    try {
      await addBulkPlayers({
        tournamentId: tournamentId as Id<"tournaments">,
        adminToken,
        names
      });
      setBulkNames("");
      toast.success(`Dodano ${names.length} graczy`);
    } catch (e) {
      toast.error("Błąd podczas dodawania masowego");
    }
  };

  const handleCopyLink = (player: any) => {
    const url = `${origin}/t/${tournamentId}/player/${player.playerToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(player._id);
    toast.success("Link skopiowany!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemove = async (id: string) => {
    if (!adminToken) return;
    if (!confirm("Na pewno usunąć tego uczestnika?")) return;
    try {
      await removePlayer({
        playerId: id as Id<"players">,
        adminToken: adminToken,
      });
      toast.success("Uczestnik usunięty");
    } catch (e) {
      toast.error("Błąd usuwania");
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Uczestnicy</h1>
            <p className="text-muted-foreground">Dodaj graczy ręcznie lub wklej listę z Excela.</p>
          </div>
          <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/20 flex items-center gap-2 text-sm font-medium">
            <Users weight="bold" className="w-5 h-5" />
            {players ? players.length : 0} Uczestników
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Dodawanie graczy (Lewa kolumna) */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2 text-foreground">
                <UserPlus className="w-4 h-4 text-blue-500" /> Dodaj pojedynczo
              </h2>
              <form onSubmit={handleAddSingle} className="flex gap-2">
                <Input 
                  placeholder="Imię i nazwisko" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  className="bg-background"
                />
                <Button type="submit" size="icon" disabled={!newName.trim()} className="shrink-0 bg-blue-600 hover:bg-blue-700">
                  <Plus weight="bold" />
                </Button>
              </form>
            </section>

            <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-medium mb-2 flex items-center gap-2 text-foreground">
                <Users className="w-4 h-4 text-emerald-500" /> Szybkie dodawanie
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Wklej listę, każdy gracz w nowej linii (np. z Excela).</p>
              <form onSubmit={handleAddBulk} className="space-y-3">
                <Textarea 
                  placeholder={"Jan Kowalski\nAnna Nowak\n..."} 
                  value={bulkNames} 
                  onChange={e => setBulkNames(e.target.value)}
                  className="min-h-[120px] bg-background resize-none"
                />
                <Button type="submit" className="w-full" variant="secondary" disabled={!bulkNames.trim()}>
                  Importuj listę
                </Button>
              </form>
            </section>
          </div>

          {/* Lista graczy (Prawa kolumna) */}
          <div className="lg:col-span-2">
            <section className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
              <div className="p-4 border-b border-border/50 bg-zinc-900/50 flex items-center justify-between">
                <h2 className="text-sm font-medium">Lista zarejestrowanych</h2>
                <div className="text-xs text-muted-foreground">Kopiuj prywatne linki, aby rozesłać je graczom.</div>
              </div>
              
              <div className="p-2">
                {!players ? (
                  <div className="space-y-2 p-2">
                    {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-800/30 rounded-lg animate-pulse" />)}
                  </div>
                ) : players.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 border border-zinc-700">
                      <Users className="w-6 h-6 text-zinc-500" />
                    </div>
                    <p className="text-sm">Brak uczestników</p>
                    <p className="text-xs mt-1 text-zinc-500">Dodaj pierwszego gracza po lewej stronie</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <AnimatePresence>
                      {players.map((player) => (
                        <motion.div
                          key={player._id}
                          initial={{ opacity: 0, scale: 0.98, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, height: 0 }}
                          className="group flex items-center justify-between p-2 hover:bg-zinc-800/40 rounded-lg transition-colors border border-transparent hover:border-zinc-800/80"
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=2563eb,3b82f6&textColor=ffffff&fontWeight=700&radius=10`}
                              alt={player.name}
                              className="w-10 h-10 rounded-lg shadow-sm"
                            />
                            <div>
                              <div className="font-medium text-sm text-zinc-100">{player.name}</div>
                              <div className="text-[11px] text-zinc-500 font-mono">ID: {player.playerToken.slice(0, 8)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleCopyLink(player)}
                              className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              title="Kopiuj prywatny link gracza"
                            >
                              {copiedId === player._id ? <CheckCircle weight="fill" className="text-emerald-500" /> : <LinkIcon weight="bold" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemove(player._id)}
                              className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash weight="bold" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export const runtime = 'edge';
