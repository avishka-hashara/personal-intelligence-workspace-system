"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-between h-8 w-full p-0.5 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-sidebar-border ${className}`}
        aria-hidden="true"
      >
        <div className="flex-1 h-full rounded-lg" />
        <div className="flex-1 h-full rounded-lg" />
        <div className="flex-1 h-full rounded-lg" />
      </div>
    );
  }

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Theme selector"
      className={`flex items-center justify-between p-0.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-sidebar-border shadow-subtle backdrop-blur-md transition-all select-none ${className}`}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const isSelected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={`flex-1 flex items-center justify-center py-1 px-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer active:scale-95 ${
              isSelected
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-subtle border border-transparent dark:border-white/10"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5 stroke-[1.8] shrink-0" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
