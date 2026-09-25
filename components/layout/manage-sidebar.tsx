"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  GearSix,
  Users,
  ChartBar,
  CalendarBlank,
  Presentation,
  Trophy,
  ArrowLeft,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  Shield
} from "@phosphor-icons/react";

interface ManageSidebarProps {
  tournamentId: string;
}

const NAV_ITEMS = [
  { icon: GearSix,        label: "Ogólne",       segment: "general"      },
  { icon: Shield,         label: "Zespoły",      segment: "teams"        },
  { icon: Users,          label: "Uczestnicy",   segment: "players"      },
  { icon: ChartBar,       label: "Podział",      segment: "structure"    },
  { icon: CalendarBlank,  label: "Harmonogram",  segment: "schedule"     },
  { icon: Trophy,         label: "Wyniki",        segment: "results"      },
  { icon: Presentation,   label: "Prezentacja",  segment: "presentation" },
] as const;

export function ManageSidebar({ tournamentId }: ManageSidebarProps) {
  const pathname  = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const tournament = useQuery(api.tournaments.get, {
    id: tournamentId as Id<"tournaments">,
  });

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    href: `/t/${tournamentId}/manage/${item.segment}`,
  }));

  /* ─── Desktop sidebar ─────────────────────────────────────── */
  return (
    <>
      {/* ── LEFT SIDEBAR (lg+) ────────────────────────────────── */}
      <motion.aside 
        initial={false}
        animate={{ width: isExpanded ? 240 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col shrink-0 h-screen sticky top-0 bg-zinc-950 border-r border-zinc-800/60 z-20 overflow-hidden"
      >
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 w-6 h-6 rounded-full flex items-center justify-center border border-zinc-700 z-50 transition-colors shadow-lg"
        >
          {isExpanded ? <CaretLeft className="w-3 h-3" /> : <CaretRight className="w-3 h-3" />}
        </button>

        {/* Top: logo + tournament name */}
        <div className={cn("px-5 pt-6 pb-5 border-b border-zinc-800/60 flex flex-col gap-3 transition-all", !isExpanded && "items-center px-2")}>
          {/* Brand mark */}
          <Link href="/" className="flex items-center group mb-1">
            <span className={cn("font-black tracking-tighter text-zinc-100 uppercase group-hover:text-blue-400 transition-colors", isExpanded ? "text-[22px]" : "text-sm")}>
              {isExpanded ? "VERSO" : "V"}
            </span>
          </Link>

          {/* Tournament name */}
          {isExpanded && (
            <div className="flex flex-col gap-0.5 pl-0.5 whitespace-nowrap overflow-hidden">
              <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-600">
                Turniej
              </span>
              <AnimatePresence mode="wait">
                {tournament ? (
                  <motion.p
                    key="name"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-semibold text-zinc-100 leading-tight truncate"
                  >
                    {tournament.name}
                  </motion.p>
                ) : (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-4 w-28 rounded bg-zinc-800 animate-pulse"
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {items.map((item, index) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: index * 0.04, ease: "easeOut" }}
              >
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "group relative flex items-center rounded-lg transition-colors duration-150",
                    isExpanded ? "gap-3 px-3 py-2.5" : "justify-center p-3",
                    isActive
                      ? "text-blue-400"
                      : "text-zinc-500 hover:text-zinc-200"
                  )}
                >
                  {/* Pill background */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-lg bg-blue-500/10 border border-blue-500/20"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}

                  {/* Left accent bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-accent"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}

                  {/* Hover bg (non-active) */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-lg bg-zinc-800/0 group-hover:bg-zinc-800/50 transition-colors duration-150" />
                  )}

                  <Icon
                    weight={isActive ? "fill" : "regular"}
                    className="relative z-10 w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                  {isExpanded && (
                    <span className="relative z-10 text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className={cn("py-4 border-t border-zinc-800/60 flex flex-col gap-2", isExpanded ? "px-3" : "px-2 items-center")}>
          {/* Live page */}
          <Link
            href={`/t/${tournamentId}/public`}
            target="_blank"
            title="Strona Live"
            className={cn(
              "group flex items-center rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/35 transition-all duration-150",
              isExpanded ? "gap-2.5 px-3 py-2" : "justify-center p-2.5"
            )}
          >
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {isExpanded && <span className="text-xs font-semibold tracking-wide flex-1 whitespace-nowrap">Strona Live</span>}
            {isExpanded && (
              <ArrowSquareOut
                weight="bold"
                className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
              />
            )}
          </Link>

          {/* Back to home */}
          <Link
            href="/"
            title="Panel główny"
            className={cn(
              "group flex items-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-150",
              isExpanded ? "gap-2.5 px-3 py-2" : "justify-center p-2.5"
            )}
          >
            <ArrowLeft
              weight="bold"
              className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            {isExpanded && <span className="text-xs font-medium whitespace-nowrap">Panel główny</span>}
          </Link>
        </div>
      </motion.aside>

      {/* ── BOTTOM TAB BAR (mobile, < lg) ────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/70">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-150",
                isActive ? "text-blue-400" : "text-zinc-600 active:text-zinc-300"
              )}
            >
              {/* Active top bar */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-bar"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}

              {/* Tap ripple bg */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-pill"
                  className="absolute inset-x-1 inset-y-1 rounded-xl bg-blue-500/10"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}

              <Icon
                weight={isActive ? "fill" : "regular"}
                className="relative z-10 w-5 h-5"
              />
              <span
                className={cn(
                  "relative z-10 text-[10px] font-medium leading-none transition-opacity",
                  isActive ? "opacity-100" : "opacity-70"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
