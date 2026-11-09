import { redirect } from "next/navigation";

/** Por ahora la única herramienta pública es el cotizador. */
export default function ToolsPage() {
  redirect("/herramientas/cotizador");
}
