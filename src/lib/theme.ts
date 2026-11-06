export const THEME_STORAGE_KEY = "saas3d-theme:v1";

export type Theme = "light" | "dark";

export function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(storedTheme: string | null, systemPrefersDark: boolean): Theme {
  if (isTheme(storedTheme)) return storedTheme;
  return systemPrefersDark ? "dark" : "light";
}

export function getNextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

export function getThemeBootstrapScript() {
  return `(function(){try{var stored=localStorage.getItem('${THEME_STORAGE_KEY}');var system=window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=stored==='dark'||stored==='light'?stored:(system?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(error){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}})();`;
}
