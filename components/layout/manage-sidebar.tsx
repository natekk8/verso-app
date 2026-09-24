"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import {
  GearSix,
  Users,
  ChartBar,
  CalendarBlank,
  Presentation,
  Trophy,
  ArrowLeft,
} from "@phosphor-icons/react";

interface ManageSidebarProps {
  tournamentId: string;
}

export function ManageSidebar({ tournamentId }: ManageSidebarProps) {
  const pathname = usePathname();

  const items = [
    { icon: GearSix, label: "Ogólne", href: `/t/${tournamentId}/manage/general` },
    { icon: Users, label: "Uczestnicy", href: `/t/${tournamentId}/manage/players` },
    { icon: ChartBar, label: "Podział", href: `/t/${tournamentId}/manage/structure` },
    { icon: CalendarBlank, label: "Harmonogram", href: `/t/${tournamentId}/manage/schedule` },
    { icon: Trophy, label: "Wyniki", href: `/t/${tournamentId}/manage/results` },
    { icon: Presentation, label: "Prezentacja", href: `/t/${tournamentId}/manage/presentation` },
  ];

  return (
    <div className="flex flex-col w-[64px] lg:w-[220px] shrink-0 h-screen sticky top-0 bg-background/95 backdrop-blur border-r border-border/50 z-20">
      
      {/* Logo & Back button */}
      <div className="p-4 flex flex-col gap-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            <span className="text-white font-bold text-sm tracking-tighter">V</span>
          </div>
          <span className="font-bold tracking-widest text-sm hidden lg:block">VERSO</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors h-8"
        >
          <ArrowLeft weight="bold" className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block">Wróć do listy</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2">
        {items.map((item, index) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group relative",
                  isActive
                    ? "bg-blue-500/10 text-blue-500 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50 dark:hover:bg-zinc-800/50 light:hover:bg-zinc-100"
                )}
                title={item.label} // tooltip for small screen
              >
                <Icon
                  weight={isActive ? "fill" : "bold"}
                  className="w-5 h-5 shrink-0"
                />
                <span className="text-sm hidden lg:block">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Footer / Theme toggle */}
      <div className="p-4 border-t border-border/50 flex items-center justify-center lg:justify-start">
        <ThemeToggle />
      </div>
    </div>
  );
}
