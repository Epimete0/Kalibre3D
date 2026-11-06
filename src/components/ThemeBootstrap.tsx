"use client";

import { useServerInsertedHTML } from "next/navigation";
import { getThemeBootstrapScript } from "@/lib/theme";

export function ThemeBootstrap() {
  useServerInsertedHTML(() => (
    <script
      id="saas3d-theme"
      dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
    />
  ));

  return null;
}
