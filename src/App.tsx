import React, { useState } from "react";
import { ConvexClientProvider, useQuery, useMutation, api, FullTournamentData } from "./lib/convex-client";
import { RouterProvider, useRouter, Link } from "./lib/router";
import { Home } from "./pages/Home";
import { AdminHub } from "./pages/AdminHub";
import { PlayerTerminal } from "./pages/PlayerTerminal";
import { RefereeTerminal } from "./pages/RefereeTerminal";
import { SpectatorPortal } from "./pages/SpectatorPortal";
import { VenuePresenter } from "./pages/VenuePresenter";
import { Button } from "./components/ui/Button";
import { Badge } from "./components/ui/Badge";
import { Card } from "./components/ui/Card";
import {
  Trophy,
  Shield,
  User,
  Scale,
  Tv,
  Eye,
  Copy,
  Check,
  ChevronDown,
  AlertCircle,
  Home as HomeIcon,
} from "lucide-react";

export interface NavbarProps {
  tournament: FullTournamentData;
}

export const Navbar: React.FC<NavbarProps> = ({ tournament }) => {
  const { route, navigate } = useRouter();
  const slug = tournament.slug;
  const [copied, setCopied] = useState(false);

  // Query players for quick role switcher
  const players = useQuery(api.players.listByTournament, {
    tournamentId: tournament._id,
  }) || [];

  const [isPlayerMenuOpen, setIsPlayerMenuOpen] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentRole = route.role || "spectator";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#09090b]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-4">
        {/* Brand & Tournament Info */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-extrabold tracking-widest text-base hover:opacity-80 transition-opacity"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>VERSO</span>
          </Link>

          <span className="text-neutral-700 hidden sm:inline">/</span>

          <div className="hidden sm:flex items-center gap-2">
            <span className="font-semibold text-white text-sm truncate max-w-[200px]">
              {tournament.name}
            </span>
            <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
              {tournament.sportRules.preset}
            </Badge>
          </div>
        </div>

        {/* Quick Role Switcher Pill Bar */}
        <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-2xl border border-white/10 text-xs">
          {/* Spectator */}
          <button
            onClick={() => navigate(`/${slug}`)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              currentRole === "spectator"
                ? "bg-white/[0.12] text-white shadow-sm font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Widz</span>
          </button>

          {/* Admin */}
          <button
            onClick={() => {
              const token =
                tournament.adminSecret ||
                (typeof window !== "undefined"
                  ? window.localStorage.getItem(`verso_admin_${slug}`) || "admin"
                  : "admin");
              navigate(`/${slug}/admin/${token}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              currentRole === "admin"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Organizator</span>
          </button>

          {/* Player dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPlayerMenuOpen(!isPlayerMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
                currentRole === "player"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Zawodnik</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {isPlayerMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 rounded-xl bg-neutral-900 border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in duration-150">
                <div className="px-2.5 py-1.5 text-[10px] uppercase font-mono tracking-wider text-neutral-500 border-b border-white/5">
                  Wybierz zawodnika
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {players.map((p: any) => (
                    <button
                      key={p._id}
                      onClick={() => {
                        setIsPlayerMenuOpen(false);
                        navigate(`/${slug}/p/${p.secretCode}`);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/[0.08] hover:text-white truncate flex items-center justify-between"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] font-mono text-neutral-500 ml-1">
                        #{p.groupSlotIndex ?? "-"}
                      </span>
                    </button>
                  ))}
                  {players.length === 0 && (
                    <div className="p-2 text-neutral-500 text-xs text-center">Brak graczy</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Referee */}
          <button
            onClick={() => {
              const refSecret =
                tournament.refereeSecret || tournament.adminSecret || "referee";
              navigate(`/${slug}/referee/${refSecret}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              currentRole === "referee"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sędzia</span>
          </button>

          {/* Kiosk Presenter */}
          <button
            onClick={() => navigate(`/${slug}/present`)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all ${
              currentRole === "presenter"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden md:inline">TV Kiosk</span>
          </button>
        </div>

        {/* Copy Link Button */}
        <Button
          variant="glass"
          size="sm"
          onClick={handleCopyLink}
          className="text-xs gap-1.5 hidden sm:inline-flex"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Skopiowano!" : "Kopiuj URL"}</span>
        </Button>
      </div>
    </header>
  );
};

export const TournamentContainer: React.FC<{ slug: string }> = ({ slug }) => {
  const { route } = useRouter();
  const bundle = useQuery(api.tournaments.getBySlug, { slug });

  if (bundle === undefined) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-neutral-400">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-sm tracking-wider uppercase">Ładowanie turnieju...</span>
        </div>
      </div>
    );
  }

  if (bundle === null) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-5 border-white/10 bg-neutral-900/60 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white">Turniej nie został odnaleziony</h2>
            <p className="text-xs text-neutral-400">
              Nie znaleziono turnieju o identyfikatorze <span className="text-white font-mono">{slug}</span>.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => window.location.assign("/")}
          >
            Wróć do strony głównej
          </Button>
        </Card>
      </div>
    );
  }

  const isPresenter = route.role === "presenter";

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col selection:bg-neutral-800 selection:text-white">
      {!isPresenter && <Navbar tournament={bundle} />}

      <main className="flex-1 w-full">
        {route.role === "spectator" && <SpectatorPortal tournament={bundle} />}
        {route.role === "admin" && (
          <AdminHub tournament={bundle} adminSecret={route.adminSecret} />
        )}
        {route.role === "player" && (
          <PlayerTerminal tournament={bundle} playerSecret={route.playerSecret} />
        )}
        {route.role === "referee" && (
          <RefereeTerminal tournament={bundle} refereeSecret={route.refereeSecret} />
        )}
        {route.role === "presenter" && <VenuePresenter tournament={bundle} />}
      </main>
    </div>
  );
};

export const RouteDispatcher: React.FC = () => {
  const { pathname, route } = useRouter();

  if (pathname === "/" || !route.slug) {
    return <Home />;
  }

  return <TournamentContainer slug={route.slug} />;
};

export interface AppProps {
  initialPath?: string;
  mockStore?: any;
}

export const App: React.FC<AppProps> = ({ initialPath, mockStore }) => {
  return (
    <ConvexClientProvider mockStore={mockStore}>
      <RouterProvider initialPath={initialPath}>
        <RouteDispatcher />
      </RouterProvider>
    </ConvexClientProvider>
  );
};

export default App;
