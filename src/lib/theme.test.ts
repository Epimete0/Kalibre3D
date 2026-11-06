import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  getNextTheme,
  getThemeBootstrapScript,
  resolveTheme,
} from "@/lib/theme";

describe("theme preferences", () => {
  it("uses a valid stored preference before the system preference", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to the system preference when storage is empty or invalid", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("unknown", false)).toBe("light");
  });

  it("alternates between light and dark", () => {
    expect(getNextTheme("light")).toBe("dark");
    expect(getNextTheme("dark")).toBe("light");
  });

  it("builds a bootstrap script with the versioned key and system fallback", () => {
    const script = getThemeBootstrapScript();

    expect(THEME_STORAGE_KEY).toBe("saas3d-theme:v1");
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("dataset.theme");
  });
});
