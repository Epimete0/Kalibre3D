/**
 * Primeros pasos de un taller nuevo (panel de inicio). Módulo puro: recibe hechos y arma la lista.
 * Orden: costos → primera bobina → primera venta, porque cada venta tiene costos detrás y así la primera
 * venta ya muestra la ganancia real. Se muestra al Dueño/Administrador hasta que los tres pasos están hechos.
 */

export type GettingStartedFacts = {
  hasOrder: boolean;
  settingsConfigured: boolean;
  hasSpool: boolean;
};

export type GettingStartedStep = {
  key: "costs" | "first-spool" | "first-sale";
  title: string;
  description: string;
  href: string;
  action: string;
  done: boolean;
};

export type GettingStarted = {
  steps: GettingStartedStep[];
  completed: number;
  allDone: boolean;
};

/** Margen para distinguir "creada con valores por defecto" de "guardada por la persona". */
const SETTINGS_SAVED_MARGIN_MS = 1000;

/** La configuración cuenta como revisada cuando alguien la guardó después de crearse con los valores por defecto. */
export function settingsWereSaved(settings: { createdAt: Date; updatedAt: Date } | null): boolean {
  if (!settings) return false;
  return settings.updatedAt.getTime() - settings.createdAt.getTime() > SETTINGS_SAVED_MARGIN_MS;
}

export function buildGettingStarted(facts: GettingStartedFacts): GettingStarted {
  const steps: GettingStartedStep[] = [
    {
      key: "costs",
      title: "Revisa tus costos",
      description: "Luz, comisiones, IVA y tu margen mínimo. Todo es opcional: activa solo lo que quieras considerar.",
      href: "/settings",
      action: "Revisar costos",
      done: facts.settingsConfigured,
    },
    {
      key: "first-spool",
      title: "Agrega tu primera bobina",
      description: "Material, color y cuánto pagaste. Así sabes cuánto te cuesta cada gramo y te avisamos cuando se acabe.",
      href: "/spools?nueva=1",
      action: "Agregar bobina",
      done: facts.hasSpool,
    },
    {
      key: "first-sale",
      title: "Registra tu primera venta",
      description: "Anota qué vendiste y en cuánto. Toma menos de un minuto.",
      href: "/orders/new",
      action: "Registrar venta",
      done: facts.hasOrder,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, allDone: completed === steps.length };
}
