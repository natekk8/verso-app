"use client";

import * as React from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-9 h-9 opacity-0">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex items-center justify-center w-9 h-9 relative rounded-md transition-colors text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800/50 focus:outline-none"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={isDark ? "dark" : "light"}
            initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px]" weight="bold" />
            ) : (
              <Moon className="h-[18px] w-[18px]" weight="bold" />
            )}
          </motion.div>
        </AnimatePresence>
        <span className="sr-only">Zmień motyw</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Zmień motyw</p>
      </TooltipContent>
    </Tooltip>
  );
}
