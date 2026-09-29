import React, { useState } from "react";
import { useQuery, useMutation, api } from "../lib/convex-client";
import { useRouter, Link } from "../lib/router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SportWizard } from "../components/wizard/SportWizard";
import { Trophy, Play, Plus, RefreshCw, Check, ArrowRight, Shield, Users, Radio } from "lucide-react";

export const Home: React.FC = () => {
  const { navigate } = useRouter();
  const tournaments = useQuery(api.tournaments.list) || [];
  const restoreSeed = useMutation(api.seed.restoreFssShowcase);
  const createTournament = useMutation(api.tournaments.create);

  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const handleRestoreFss = async () => {
    setIsRestoring(true);
    try {
      const res = await restoreSeed({});
      setRestoreSuccess(true);
      setTimeout(() => setRestoreSuccess(false), 3000);
      navigate(`/${res.slug}`);
    } catch (e) {
      console.error("Failed to restore FSS seed", e);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleWizardSave = async (wizardState: any) => {
    setCreateLoading(true);
    try {
      const name = wizardState.tournamentName || "Turniej Verso";
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const res = await createTournament({
        name,
        slug,
        sportPreset: wizardState.preset,
        customRules: {
          singularUnit: wizardState.singularUnit,
          pluralUnit: wizardState.pluralUnit,
          targetPointsPerUnit: wizardState.targetPointsPerUnit,
          unitsToWinMatch: wizardState.unitsToWinMatch,
          hasDeciderTiebreak: wizardState.hasDeciderTiebreak,
          deciderThreshold: wizardState.deciderThreshold,
          deciderPoints: wizardState.deciderPoints,
          winByTwo: wizardState.winByTwo,
        },
        days: ["2026-10-02", "2026-10-03"],
        pitches: ["Stół 1", "Stół 2"],
        allowPlayerScoreSubmission: true,
      });

      navigate(`/${res.slug}/admin/${res.adminSecret}`);
    } catch (err) {
      console.error("Failed to create tournament", err);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-neutral-800 selection:text-white">
      {/* Hero Header */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-neutral-900/60 to-transparent py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            VERSO TOURNAMENT PLATFORM
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
            Precyzyjne zarządzanie turniejami sportowymi
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-400">
            Kompleksowa platforma dla organizatorów, sędziów, zawodników i kibiców.
            Algorytmiczny terminarz Bergera, tabele z 7-stopniowymi tiebreakerami i taktyczny terminal sędziowski.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRestoreFss}
              isLoading={isRestoring}
              className="gap-2 font-semibold shadow-lg shadow-emerald-950/40"
            >
              <Play className="w-4 h-4 fill-current" />
              Uruchom pokazowy turniej FSS
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setIsCreating(!isCreating)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? "Ukryj kreator turnieju" : "Stwórz nowy turniej"}
            </Button>
          </div>

          {restoreSuccess && (
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              Przywrócono pełne dane pokazowe turnieju FSS!
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Creation Wizard */}
        {isCreating && (
          <div className="p-6 sm:p-8 rounded-2xl bg-neutral-900/50 border border-white/10 backdrop-blur-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">Kreator Nowego Turnieju</h2>
                <p className="text-xs text-neutral-400">
                  Wybierz dyscyplinę i skonfiguruj zasady punktacji meczowej
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                Anuluj
              </Button>
            </div>

            <SportWizard
              mode="create"
              tournamentName="Nowy Turniej"
              onSave={handleWizardSave}
              isLoading={createLoading}
            />
          </div>
        )}

        {/* Active Tournaments Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Dostępne Turnieje
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestoreFss}
              className="text-xs text-neutral-400 hover:text-white gap-1.5 font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Zresetuj FSS Seed
            </Button>
          </div>

          {tournaments.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <p className="text-neutral-400 text-sm">Brak zarejestrowanych turniejów.</p>
              <Button variant="primary" size="sm" onClick={handleRestoreFss}>
                Załaduj turniej pokazowy FSS
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournaments.map((t: any) => (
                <Card
                  key={t._id}
                  className="p-6 space-y-4 hover:border-white/20 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="emerald" size="sm" className="mb-2">
                        AKTYWNY TURNIEJ
                      </Badge>
                      <h3 className="text-lg font-bold text-white tracking-tight">{t.name}</h3>
                      <span className="text-xs font-mono text-neutral-500">/{t.slug}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                    <Link
                      href={`/${t.slug}`}
                      className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex items-center justify-between"
                    >
                      <span>Widok Widza</span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500" />
                    </Link>

                    <Link
                      href={`/${t.slug}/admin/${t.adminSecret}`}
                      className="px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center justify-between"
                    >
                      <span>Panel Admina</span>
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
