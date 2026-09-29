import React, { useState, useRef } from "react";
import { useQuery, useMutation, api } from "../lib/convex-client";
import { useRouter, Link } from "../lib/router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SportWizard } from "../components/wizard/SportWizard";
import {
  Trophy,
  Plus,
  ArrowRight,
  Shield,
  Users,
  Tv,
  Scale,
  Sparkles,
  Calendar,
  Layers,
  ChevronDown,
  Activity,
  CheckCircle2,
} from "lucide-react";

export const Home: React.FC = () => {
  const { navigate } = useRouter();
  const tournaments = useQuery(api.tournaments.list) || [];
  const createTournament = useMutation(api.tournaments.create);

  const [isCreating, setIsCreating] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const wizardRef = useRef<HTMLDivElement>(null);
  const tournamentsSectionRef = useRef<HTMLDivElement>(null);

  const handleOpenCreator = () => {
    setIsCreating(true);
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleScrollToTournaments = () => {
    tournamentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleWizardSave = async (wizardState: any) => {
    setCreateLoading(true);
    try {
      const name = wizardState.tournamentName || "Nowy Turniej";
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const slug = baseSlug.length > 0 ? `${baseSlug}-${uniqueSuffix}` : `turniej-${uniqueSuffix}`;

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

      // Automatically store admin secret in localStorage for instant passwordless rehydration
      if (typeof window !== "undefined" && window.localStorage && res.adminSecret) {
        window.localStorage.setItem(`verso_admin_${res.slug}`, res.adminSecret);
      }

      navigate(`/${res.slug}/admin/${res.adminSecret}`);
    } catch (err) {
      console.error("Failed to create tournament", err);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-neutral-800 selection:text-white flex flex-col justify-between">
      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-2xl">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2500px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-3 h-3 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform duration-300" />
            <span className="font-extrabold tracking-widest text-lg text-white">VERSO</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-neutral-400 ml-1">
              v1.0
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {tournaments.length > 0 && (
              <button
                onClick={handleScrollToTournaments}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl hover:bg-white/[0.04]"
              >
                <span>Turnieje ({tournaments.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreator}
              className="gap-1.5 text-xs font-semibold shadow-lg shadow-emerald-950/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Stwórz turniej</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2500px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-12 sm:py-16 2xl:py-24 space-y-20 2xl:space-y-32">
        {/* Hero Section — AIDA Attention */}
        <section className="relative text-center space-y-6 pt-4 pb-8 max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-emerald-400 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>BEZ LIMITU ZAWODNIKÓW · PEŁNA DOWOLNOŚĆ REGUŁ</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl 3xl:text-8xl font-black tracking-tight text-white leading-[1.08]">
            Nowoczesne zarządzanie <br className="hidden sm:inline" />
            turniejami bez barier
          </h1>

          <p className="max-w-2xl 2xl:max-w-3xl mx-auto text-base sm:text-lg 2xl:text-xl text-neutral-400 leading-relaxed font-normal">
            Twórz, planuj i prowadź turnieje w czasie rzeczywistym. Dynamiczny generator reguł,
            algorytm Bergera, brak haseł dzięki bezpiecznym linkom tokenowym oraz ekran TV Kiosk dla kibiców.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenCreator}
              className="gap-2 font-semibold text-sm sm:text-base px-6 py-3.5 shadow-xl shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>Stwórz nowy turniej</span>
            </Button>

            {tournaments.length > 0 && (
              <Button
                variant="secondary"
                size="lg"
                onClick={handleScrollToTournaments}
                className="gap-2 text-sm sm:text-base px-6 py-3.5"
              >
                <span>Przeglądaj aktywne turnieje</span>
                <ArrowRight className="w-4 h-4 text-neutral-400" />
              </Button>
            )}
          </div>
        </section>

        {/* Tournament Creation Wizard (Expands smoothly) */}
        {isCreating && (
          <section
            ref={wizardRef}
            className="p-6 sm:p-10 2xl:p-14 rounded-3xl bg-neutral-900/60 border border-white/10 backdrop-blur-2xl space-y-8 animate-in fade-in duration-300 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="emerald" size="sm">
                    KREATOR VERSO
                  </Badge>
                  <span className="text-xs font-mono text-neutral-400">KROK PO KROKU</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  Stwórz nowy turniej
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                  Wybierz dyscyplinę sportową lub stwórz własną z dowolnymi zasadami punktacji
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(false)}
                className="text-neutral-400 hover:text-white"
              >
                Zamknij
              </Button>
            </div>

            <SportWizard
              mode="create"
              tournamentName="Nowy Turniej"
              onSave={handleWizardSave}
              isLoading={createLoading}
            />
          </section>
        )}

        {/* Tournaments List Section */}
        <section ref={tournamentsSectionRef} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <Trophy className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>Aktywne Turnieje</span>
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400">
                Wszystkie turnieje zarejestrowane na platformie Verso
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenCreator}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dodaj turniej</span>
            </Button>
          </div>

          {tournaments.length === 0 ? (
            <div className="p-12 sm:p-16 rounded-3xl bg-neutral-900/30 border border-white/[0.06] text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-neutral-400 mx-auto flex items-center justify-center">
                <Trophy className="w-7 h-7 text-neutral-500" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white">Brak zarejestrowanych turniejów</h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Nie ma jeszcze żadnego turnieju w bazie. Kliknij przycisk poniżej, aby stworzyć swój pierwszy turniej w mniej niż minutę.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenCreator}
                className="gap-2 font-semibold text-xs shadow-lg shadow-emerald-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Stwórz pierwszy turniej</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-5">
              {tournaments.map((t: any) => {
                const storedSecret =
                  typeof window !== "undefined" && window.localStorage
                    ? window.localStorage.getItem(`verso_admin_${t.slug}`)
                    : null;
                const adminUrl = storedSecret
                  ? `/${t.slug}/admin/${storedSecret}`
                  : `/${t.slug}/admin`;

                return (
                  <Card
                    key={t._id}
                    className="p-6 space-y-5 hover:border-white/[0.18] transition-all duration-300 bg-neutral-900/40 backdrop-blur-xl flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="emerald" size="sm" dot>
                          TURNIEJ AKTYWNY
                        </Badge>
                        <span className="text-xs font-mono text-neutral-500">/{t.slug}</span>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                          {t.name}
                        </h3>
                        {t.sportRules && (
                          <p className="text-xs text-neutral-400 mt-1 font-mono">
                            {t.sportRules.unitsToWinMatch} wygrane {t.sportRules.pluralUnit || "Sety"} · do {t.sportRules.targetPointsPerUnit || 11} pkt
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/[0.06] text-xs font-medium">
                      <Link
                        href={`/${t.slug}`}
                        className="py-2.5 px-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white flex flex-col items-center justify-center gap-1 transition-colors text-center"
                        title="Portal Widza"
                      >
                        <Users className="w-4 h-4 text-neutral-400" />
                        <span className="text-[11px]">Widz</span>
                      </Link>

                      <Link
                        href={adminUrl}
                        className="py-2.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex flex-col items-center justify-center gap-1 transition-colors text-center"
                        title="Panel Organizatora"
                      >
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px]">Panel</span>
                      </Link>

                      <Link
                        href={`/${t.slug}/present`}
                        className="py-2.5 px-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex flex-col items-center justify-center gap-1 transition-colors text-center"
                        title="Ekran TV Kiosk"
                      >
                        <Tv className="w-4 h-4 text-purple-400" />
                        <span className="text-[11px]">TV Kiosk</span>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* 4-Tile Gapless Bento Grid — Architecture Highlights */}
        <section className="space-y-6 pt-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Filary Architektury Verso</h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Zbudowane z myślą o natychmiastowej responsywności i bezawaryjnej pracy pod obciążeniem
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 grid-flow-dense">
            {/* Tile 1 */}
            <Card className="p-6 space-y-3 bg-neutral-900/30 border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Dynamiczny Silnik Reguł</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Dowolne nazewnictwo jednostek (Set, Głowa, Gem, Połowa) z inteligentną odmianą liczby pojedynczej i mnogiej, punktacją decydującą oraz zasadą win-by-two.
              </p>
            </Card>

            {/* Tile 2 */}
            <Card className="p-6 space-y-3 bg-neutral-900/30 border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Matematyczny Berger</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Algorytm Bergera generuje bezbłędny harmonogram round-robin dla dowolnej liczby uczestników z automatycznymi pauzami i ochroną przed kolizjami przerw.
              </p>
            </Card>

            {/* Tile 3 */}
            <Card className="p-6 space-y-3 bg-neutral-900/30 border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Dostęp Bez Logowania</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Koniec z zapomnianymi hasłami. Każdy uczestnik, sędzia i organizator otrzymuje unikalny token URL. Wystarczy kliknąć swój prywatny link.
              </p>
            </Card>

            {/* Tile 4 */}
            <Card className="p-6 space-y-3 bg-neutral-900/30 border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Tv className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Prezenter Kiosk TV</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Automatycznie rotujący ekran dla telewizorów i rzutników w hali. Prezentuje aktualną tabelę, mecze na żywo oraz komunikaty organizatora.
              </p>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl py-6 mt-16">
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2500px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-neutral-300 font-semibold">VERSO TOURNAMENT ENGINE</span>
            <span>·</span>
            <span>PROD CLOUD READY</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-500">
            <span>FULL HD · 2K · 4K · 8K RESPONSIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
