"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, CalendarPlus, Check, X, WarningCircle } from "@phosphor-icons/react";
import { Separator } from "@/components/ui/separator";

export default function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const adminToken = getAdminToken(tournamentId) || "";

  const tournament = useQuery(api.tournaments.get, { id: tournamentId as Id<"tournaments"> });
  const updateSettings = useMutation(api.tournaments.updateSettings);
  const updateName = useMutation(api.tournaments.updateName);
  const updateMatchDays = useMutation(api.tournaments.updateMatchDays);
  const updateLocations = useMutation(api.tournaments.updateLocations);

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  
  // local copy for optimistic editing without spamming DB
  const [matchDays, setMatchDays] = useState<{ id: string; date: string; startTime?: string; endTime?: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; order: number }[]>([]);

  // Sync with DB
  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setSport(tournament.sport || "");
      setIsOnline(tournament.isOnline);
      setMatchDays(tournament.matchDays);
      setLocations(tournament.locations);
    }
  }, [tournament]);

  const handleSaveGeneral = async () => {
    try {
      if (name !== tournament?.name) {
        await updateName({ id: tournamentId as Id<"tournaments">, name, adminToken });
      }
      await updateSettings({ 
        id: tournamentId as Id<"tournaments">, 
        adminToken, 
        sport: sport || undefined,
        isOnline 
      });
      toast.success("Ustawienia podstawowe zapisane");
    } catch (e) {
      toast.error("Błąd podczas zapisywania");
    }
  };

  const handleSaveDays = async () => {
    try {
      await updateMatchDays({ id: tournamentId as Id<"tournaments">, adminToken, matchDays });
      toast.success("Dni turniejowe zaktualizowane");
    } catch (e) {
      toast.error("Błąd podczas aktualizacji dni");
    }
  };

  const handleSaveLocations = async () => {
    try {
      await updateLocations({ id: tournamentId as Id<"tournaments">, adminToken, locations });
      toast.success("Miejsca spotkań zaktualizowane");
    } catch (e) {
      toast.error("Błąd podczas aktualizacji miejsc");
    }
  };

  if (tournament === undefined) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 bg-card rounded w-1/4"></div>
        <div className="h-64 bg-card rounded-xl"></div>
      </div>
    );
  }

  if (tournament === null || tournament.adminToken !== adminToken) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center mt-20">
        <WarningCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Brak dostępu</h2>
        <p className="text-muted-foreground">Nie masz uprawnień do zarządzania tym turniejem lub taki turniej nie istnieje.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-3xl font-semibold tracking-tight mb-8">Ogólne</h1>

        <div className="space-y-12">
          
          {/* Sekcja 1: Nazwa i Podstawy */}
          <section className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-medium">Podstawowe informacje</h2>
              <p className="text-sm text-muted-foreground">Ustawienia, które będą widoczne dla wszystkich.</p>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa turnieju</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-md bg-background" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sport">Sport</Label>
                <Input id="sport" placeholder="np. Ping-pong" value={sport} onChange={(e) => setSport(e.target.value)} className="max-w-md bg-background" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSaveGeneral} disabled={name === tournament.name && sport === (tournament.sport || "")}>
                  Zapisz zmiany
                </Button>
              </div>
            </div>
          </section>

          {/* Sekcja 2: Dni turniejowe */}
          <section className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium">Dni meczowe</h2>
                <p className="text-sm text-muted-foreground">Wybierz dni, w których odbywa się turniej (potrzebne do harmonogramu).</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setMatchDays([...matchDays, { id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0], startTime: "09:00", endTime: "18:00" }])}
              >
                <CalendarPlus className="w-4 h-4" /> Dodaj dzień
              </Button>
            </div>

            <div className="space-y-3">
              {matchDays.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border/50 rounded-lg text-muted-foreground text-sm">
                  Nie zdefiniowano żadnych dni.
                </div>
              ) : (
                matchDays.map((day, idx) => (
                  <div key={day.id} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center p-3 border border-border/50 rounded-lg bg-background/50">
                    <div className="grid gap-1.5 flex-1 w-full">
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <Input 
                        type="date" 
                        value={day.date}
                        onChange={(e) => {
                          const newDays = [...matchDays];
                          newDays[idx].date = e.target.value;
                          setMatchDays(newDays);
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5 w-full sm:w-24">
                      <Label className="text-xs text-muted-foreground">Od</Label>
                      <Input 
                        type="time" 
                        value={day.startTime || "09:00"}
                        onChange={(e) => {
                          const newDays = [...matchDays];
                          newDays[idx].startTime = e.target.value;
                          setMatchDays(newDays);
                        }}
                      />
                    </div>
                    <div className="grid gap-1.5 w-full sm:w-24">
                      <Label className="text-xs text-muted-foreground">Do</Label>
                      <Input 
                        type="time" 
                        value={day.endTime || "18:00"}
                        onChange={(e) => {
                          const newDays = [...matchDays];
                          newDays[idx].endTime = e.target.value;
                          setMatchDays(newDays);
                        }}
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-destructive w-10 h-10 shrink-0"
                      onClick={() => setMatchDays(matchDays.filter(d => d.id !== day.id))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            {JSON.stringify(matchDays) !== JSON.stringify(tournament.matchDays) && (
              <div className="pt-4">
                <Button onClick={handleSaveDays}>Zapisz dni</Button>
              </div>
            )}
          </section>

          {/* Sekcja 3: Miejsca / Stoły / Boiska */}
          <section className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium">Miejsca / Boiska</h2>
                <p className="text-sm text-muted-foreground">Gdzie odbywają się spotkania? (np. Boisko 1, Stół A)</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setLocations([...locations, { id: crypto.randomUUID(), name: `Miejsce ${locations.length + 1}`, order: locations.length }])}
              >
                <MapPin className="w-4 h-4" /> Dodaj miejsce
              </Button>
            </div>

            <div className="space-y-3">
              {locations.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border/50 rounded-lg text-muted-foreground text-sm">
                  Turniej online lub brak miejsc.
                </div>
              ) : (
                locations.map((loc, idx) => (
                  <div key={loc.id} className="flex gap-3 items-center p-3 border border-border/50 rounded-lg bg-background/50">
                    <div className="w-8 h-8 rounded bg-zinc-800/50 flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 border border-border/50">
                      {idx + 1}
                    </div>
                    <Input 
                      value={loc.name}
                      placeholder="Nazwa miejsca (np. Stół do ping-ponga)"
                      className="flex-1"
                      onChange={(e) => {
                        const newLocs = [...locations];
                        newLocs[idx].name = e.target.value;
                        setLocations(newLocs);
                      }}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setLocations(locations.filter(l => l.id !== loc.id))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            
            {JSON.stringify(locations) !== JSON.stringify(tournament.locations) && (
              <div className="pt-4">
                <Button onClick={handleSaveLocations}>Zapisz miejsca</Button>
              </div>
            )}
          </section>

        </div>
      </motion.div>
    </div>
  );
}
