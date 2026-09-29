import React, { useState, useEffect, useRef, useCallback } from "react";
import { FullTournamentData, useQuery, api } from "../lib/convex-client";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  Trophy,
  Calendar,
  Megaphone,
  Tv,
  Maximize,
  Minimize,
  Clock,
  Radio,
} from "lucide-react";

export interface VenuePresenterProps {
  tournament: FullTournamentData;
}

type Slide = "standings" | "matches" | "announcement";

const SLIDE_ORDER: Slide[] = ["standings", "matches", "announcement"];

export const VenuePresenter: React.FC<VenuePresenterProps> = ({ tournament }) => {
  // Configurable rotation from tournament.slides settings (M5 requirement)
  const rotationInterval = (tournament.slides?.rotationIntervalSeconds ?? 12) * 1000;
  const activeSlides: Slide[] = (tournament.slides?.activeSlides as Slide[]) ??
    SLIDE_ORDER;
  const announcementText =
    tournament.slides?.announcementText ||
    "Witamy wszystkich zawodników i kibiców! Prosimy o zgłaszanie się do sędziów na 5 minut przed planowanym rozpoczęciem pojedynku.";

  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  const activeTab: Slide = activeSlides[slideIndex % activeSlides.length] ?? "standings";

  // Data queries
  const standings = useQuery(api.standings.getGroupStandings, {
    tournamentId: tournament._id,
    groupId: tournament.groups?.[0]?._id,
  }) || [];

  const matches = useQuery(api.matches.listByTournament, {
    tournamentId: tournament._id,
  }) || [];

  const liveMatches = matches.filter((m: any) => m.status === "in_progress");
  const upcomingMatches = matches.filter((m: any) => m.status === "pending").slice(0, 6);
  const completedCount = matches.filter((m: any) => m.status === "completed").length;

  // Smooth progress bar + slide advance (M5: configurable interval)
  useEffect(() => {
    startTimeRef.current = Date.now();
    progressRef.current = 0;
    setProgress(0);
    setIsVisible(false);

    // Fade in after micro-delay
    const fadeIn = setTimeout(() => setIsVisible(true), 60);

    const tick = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / rotationInterval) * 100, 100);
      progressRef.current = pct;
      setProgress(pct);

      if (elapsed >= rotationInterval) {
        setSlideIndex((prev) => (prev + 1) % activeSlides.length);
      }
    }, 50);

    return () => {
      clearInterval(tick);
      clearTimeout(fadeIn);
    };
  }, [slideIndex, rotationInterval, activeSlides.length]);

  // Fullscreen toggle (M6)
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Clock display
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const clockStr = clock.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = clock.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#030303] text-white flex flex-col selection:bg-neutral-800"
    >
      {/* Progress Bar (M5: smooth configurable auto-rotation indicator) */}
      <div className="h-[2px] bg-neutral-900 w-full fixed top-0 left-0 z-50">
        <div
          className="h-full bg-emerald-400 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Kiosk Top Bar */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
            <Tv className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="emerald" dot pulse size="sm">
                VENUE TV
              </Badge>
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                VERSO KIOSK
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">
              {tournament.name}
            </h1>
          </div>
        </div>

        {/* Right: clock + slide pills + fullscreen */}
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          {liveMatches.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <Radio className="w-3 h-3 animate-pulse" />
              {liveMatches.length} NA ŻYWO
            </div>
          )}

          {/* Clock */}
          <div className="hidden lg:flex flex-col items-end text-right">
            <span className="font-mono text-white text-base font-bold tracking-widest">
              {clockStr}
            </span>
            <span className="text-xs text-neutral-500 capitalize">{dateStr}</span>
          </div>

          {/* Slide Tabs */}
          <div className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-xl border border-white/[0.07]">
            {SLIDE_ORDER.map((s, i) => (
              <button
                key={s}
                onClick={() => setSlideIndex(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  activeTab === s
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/50"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {s === "standings" ? "Tabela" : s === "matches" ? "Mecze" : "Ogłoszenia"}
              </button>
            ))}
          </div>

          {/* Fullscreen toggle (M6) */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-400 hover:text-white transition-all"
            title={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Slide Content (M5: fade transition between slides) */}
      <main
        className="flex-1 flex flex-col justify-center py-10 px-8"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.35s ease-out",
        }}
      >
        {/* STANDINGS SLIDE */}
        {activeTab === "standings" && (
          <div className="space-y-8 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
                <Trophy className="w-7 h-7 text-amber-400 shrink-0" />
                Klasyfikacja Grupowa
              </h2>
              <div className="flex items-center gap-3 text-sm text-neutral-500 font-mono">
                <Clock className="w-4 h-4" />
                <span>{completedCount} / {matches.length} rozegranych</span>
              </div>
            </div>

            <Card className="overflow-hidden border border-white/[0.07] bg-neutral-950/60 backdrop-blur-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.07] text-xs font-mono text-neutral-500 uppercase bg-white/[0.015]">
                    <th className="py-4 px-6 w-12">#</th>
                    <th className="py-4 px-6">Zawodnik</th>
                    <th className="py-4 px-6 text-center">M</th>
                    <th className="py-4 px-6 text-center text-emerald-500">W</th>
                    <th className="py-4 px-6 text-center text-rose-500">P</th>
                    <th className="py-4 px-6 text-center">Sety</th>
                    <th className="py-4 px-6 text-center">Pkt</th>
                    <th className="py-4 px-6 text-right font-bold text-white">PKT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {standings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-neutral-600 text-sm">
                        Brak rozegranych meczów
                      </td>
                    </tr>
                  )}
                  {standings.map((s: any, idx: number) => {
                    const isQualified = idx < 4;
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                    return (
                      <tr
                        key={s.playerId}
                        className={`${isQualified ? "bg-emerald-500/[0.025]" : ""} hover:bg-white/[0.015] transition-colors`}
                      >
                        <td className="py-4 px-6">
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className={`font-bold text-base ${isQualified ? "text-emerald-400" : "text-neutral-500"}`}>
                              {s.rank}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-sans font-semibold text-white text-base">
                          {s.name || s.playerId}
                          {isQualified && (
                            <span className="ml-2 text-[10px] font-mono text-emerald-500 uppercase tracking-wider">
                              AWANS
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center text-neutral-400">{s.played}</td>
                        <td className="py-4 px-6 text-center text-emerald-400 font-bold text-lg">{s.won}</td>
                        <td className="py-4 px-6 text-center text-rose-400">{s.lost}</td>
                        <td className="py-4 px-6 text-center text-neutral-400">{s.setsWon}:{s.setsLost}</td>
                        <td className="py-4 px-6 text-center text-neutral-400">{s.pointsWon}:{s.pointsLost}</td>
                        <td className="py-4 px-6 text-right font-bold text-white text-xl">{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* MATCHES SLIDE */}
        {activeTab === "matches" && (
          <div className="space-y-8 max-w-5xl mx-auto w-full">
            <h2 className="text-3xl font-extrabold flex items-center gap-3 tracking-tight">
              <Calendar className="w-7 h-7 text-emerald-400 shrink-0" />
              Aktualne i Nadchodzące Mecze
            </h2>

            {/* Live matches — highlighted */}
            {liveMatches.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-mono text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-3 h-3 animate-pulse" />
                  Mecze NA ŻYWO
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveMatches.map((m: any) => (
                    <Card
                      key={m._id}
                      className="p-6 border-rose-500/30 bg-rose-500/[0.07] backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <Badge variant="emerald" dot pulse size="sm">
                          NA ŻYWO
                        </Badge>
                        <span className="font-mono text-xs text-neutral-400">
                          {m.pitch?.name || "Stół"} · Runda {m.roundNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-bold text-white text-xl truncate flex-1">
                          {m.player1?.name || "Zawodnik 1"}
                        </span>
                        <div className="px-5 py-2.5 rounded-2xl bg-black/50 font-mono text-3xl font-extrabold text-emerald-400 shrink-0 tabular-nums">
                          {m.sets?.length > 0
                            ? m.sets.map((s: any) => `${s.s1}:${s.s2}`).join(" | ")
                            : "0:0"}
                        </div>
                        <span className="font-bold text-white text-xl truncate flex-1 text-right">
                          {m.player2?.name || "Zawodnik 2"}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming matches */}
            <div className="space-y-3">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Kolejne spotkania
              </span>
              {upcomingMatches.length === 0 ? (
                <p className="text-neutral-600 text-sm font-mono py-4">
                  Brak zaplanowanych meczów
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {upcomingMatches.map((m: any) => (
                    <Card key={m._id} className="p-5 bg-neutral-950/60 border border-white/[0.07]">
                      <div className="flex items-center justify-between text-xs text-neutral-500 font-mono mb-3">
                        <span className="font-semibold text-white">{m.time || "18:00"}</span>
                        <span>{m.pitch?.name || "Stół"}</span>
                      </div>
                      <div className="font-semibold text-white text-sm leading-snug">
                        <div className="truncate">{m.player1?.name || "TBD"}</div>
                        <div className="text-neutral-500 text-xs my-1 font-mono">vs</div>
                        <div className="truncate">{m.player2?.name || "TBD"}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANNOUNCEMENT SLIDE */}
        {activeTab === "announcement" && (
          <div className="max-w-3xl mx-auto w-full text-center space-y-8">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Megaphone className="w-10 h-10" />
            </div>
            <div className="space-y-4">
              <div className="text-xs font-mono text-amber-500 uppercase tracking-widest">
                Komunikat Organizatora
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white leading-relaxed tracking-tight">
                {announcementText}
              </p>
            </div>
            <div className="pt-6 border-t border-white/[0.06] text-xs font-mono text-neutral-700 uppercase tracking-widest">
              VERSO TOURNAMENT DISPLAY SYSTEM
            </div>
          </div>
        )}
      </main>

      {/* Stats Footer Ticker */}
      <footer className="px-8 py-4 border-t border-white/[0.05] flex items-center justify-between text-xs font-mono text-neutral-600 bg-black/20">
        <span>VERSO LIVE KIOSK ENGINE</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ROTACJA CO {tournament.slides?.rotationIntervalSeconds ?? 12}s
        </span>
        <span>
          {standings.length} ZAWODNIKÓW · {matches.length} MECZÓW
        </span>
      </footer>
    </div>
  );
};
