"use client";

import {
  THEME_STORAGE_KEY,
  getNextTheme,
  isTheme,
  resolveTheme,
  type Theme,
} from "@/lib/theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggleTheme() {
    const storedTheme = document.documentElement.dataset.theme ?? null;
    const currentTheme = resolveTheme(
      isTheme(storedTheme) ? storedTheme : null,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const nextTheme = getNextTheme(currentTheme);
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The visual preference still applies when browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar tema de color"
      title="Alternar entre modo claro y oscuro"
      className={`inline-flex h-9 w-16 items-center justify-center gap-[3px] rounded-full border border-line bg-surface p-1 text-muted shadow-[0_1px_2px_rgba(90,40,55,.04),0_8px_24px_-12px_rgba(90,40,55,.10)] transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas touch-manipulation ${className}`}
    >
      <span className="theme-choice-light grid h-[26px] w-[26px] place-items-center rounded-full"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-[13px] w-[13px]"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg></span>
      <span className="theme-choice-dark grid h-[26px] w-[26px] place-items-center rounded-full"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]"><path d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z" /></svg></span>
      <span className="sr-only">Alternar entre modo claro y oscuro</span>
    </button>
  );
}
