"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAdminSessions, setAdminToken, generateAdminToken } from "@/lib/auth";
import { motion } from "motion/react";
import { Trophy, Plus, CalendarBlank, Users, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export default function DashboardPage() {
  const router = useRouter();
  const [adminIds, setAdminIds] = useState<Id<"tournaments">[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("");

  // Load from local storage
  useEffect(() => {
    const sessions = getAdminSessions();
    setAdminIds(sessions.map((s) => s.tournamentId as Id<"tournaments">));
  }, []);

  const tournaments = useQuery(api.tournaments.getByIds, { ids: adminIds });
  const createTournament = useMutation(api.tournaments.create);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsCreating(true);
      const token = generateAdminToken();
      const id = await createTournament({
        name: newName.trim(),
        sport: newSport.trim() || undefined,
        adminToken: token,
      });

      setAdminToken(id, token);
      toast.success("Turniej utworzony!");
      router.push(`/t/${id}/manage/general`);
    } catch (error) {
      toast.error("Błąd podczas tworzenia turnieju.");
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300">Szkic</span>;
      case "active":
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400">Aktywny</span>;
      case "finished":
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400">Zakończony</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/50 flex items-center justify-between px-6 sticky top-0 bg-background/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            <span className="text-white font-bold tracking-tighter">V</span>
          </div>
          <span className="font-bold tracking-widest text-foreground hidden sm:block">VERSO</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Twoje turnieje</h1>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-[0_0_14px_rgba(37,99,235,0.2)]">
                  <Plus weight="bold" className="mr-2 h-4 w-4" /> Nowy turniej
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Utwórz nowy turniej</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nazwa turnieju</Label>
                    <Input
                      id="name"
                      placeholder="np. Mistrzostwa 1v1 FSS"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sport">Sport (opcjonalnie)</Label>
                    <Input
                      id="sport"
                      placeholder="np. Ping-pong, Piłka nożna..."
                      value={newSport}
                      onChange={(e) => setNewSport(e.target.value)}
                    />
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isCreating || !newName.trim()}>
                      {isCreating ? "Tworzenie..." : "Utwórz turniej"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Loading state */}
          {tournaments === undefined && adminIds.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-[120px] rounded-xl border border-border/50 bg-card/50 animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {(adminIds.length === 0 || (tournaments && tournaments.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/50 rounded-xl bg-card/20">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                <Trophy weight="duotone" className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium mb-1">Brak turniejów</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                Nie zarządzasz jeszcze żadnym turniejem. Utwórz swój pierwszy turniej, aby zacząć.
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Rozpocznij</Button>
                </DialogTrigger>
                {/* Same dialog content could be abstracted, but keeping simple for now */}
              </Dialog>
            </div>
          )}

          {/* Tournaments Grid */}
          {tournaments !== undefined && tournaments.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {tournaments.map((t, index) => (
                <motion.div
                  key={t._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.2 }}
                >
                  <Link href={`/t/${t._id}/manage/general`}>
                    <div className="group relative p-5 rounded-xl border border-border/50 bg-card hover:border-border-hover hover:shadow-sm transition-all h-full flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold text-base line-clamp-1 group-hover:text-blue-400 transition-colors">
                            {t.name}
                          </h3>
                          {getStatusBadge(t.status)}
                        </div>
                        {t.sport && (
                          <div className="text-sm text-muted-foreground mb-4">
                            {t.sport}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground pt-4 border-t border-border/30">
                        {t.matchDays.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <CalendarBlank className="w-3.5 h-3.5" />
                            {new Date(t.matchDays[0].date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          -- /* Players count needs separate query, skipping for now */
                        </div>
                      </div>
                      
                      <div className="absolute right-4 bottom-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500">
                        <ArrowRight weight="bold" className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
