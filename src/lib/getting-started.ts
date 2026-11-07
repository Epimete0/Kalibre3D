/**
 * Primeros pasos de un taller nuevo (panel de inicio). Módulo puro: recibe hechos y arma la lista.
 * La lista se muestra al Dueño/Administrador hasta que los tres pasos están hechos.
 */

export type GettingStartedFacts = {
  hasOrder: boolean;
  settingsConfigured: boolean;
  hasSpool: boolean;
};

export type GettingStartedStep = {
  key: "first-sale" | "costs" | "first-spool";
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
      key: "first-sale",
      title: "Registra tu primera venta",
      description: "Anota qué vendiste y en cuánto. Toma menos de un minuto.",
      href: "/orders/new",
      action: "Registrar venta",
      done: facts.hasOrder,
    },
    {
      key: "costs",
      title: "Configura tus costos",
      description: "Luz por hora, comisión y envío de Mercado Libre. Así el cotizador calcula tu ganancia real.",
      href: "/settings",
      action: "Configurar costos",
      done: facts.settingsConfigured,
    },
    {
      key: "first-spool",
      title: "Agrega tu primera bobina",
      description: "Te avisamos cuando se esté acabando y el costo del filamento sale de lo que pagaste.",
      href: "/spools",
      action: "Agregar bobina",
      done: facts.hasSpool,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, allDone: completed === steps.length };
}
