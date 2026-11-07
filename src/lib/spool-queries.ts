import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { computeMaterialCostPerGram } from "@/lib/costing";
import { prisma } from "@/lib/prisma";

export type SpoolListItem = {
  id: string;
  material: string;
  color: string;
  brand: string | null;
  totalGrams: number;
  remainingGrams: number;
  pricePaid: number | null;
  costPerGram: number | null;
  purchasedOn: string;
  notes: string | null;
  active: boolean;
  isLow: boolean;
  remainingPct: number;
};

export type SpoolsDirectoryView = {
  spools: SpoolListItem[];
  currency: string;
  lowSpoolThresholdGrams: number;
  defaultCostPerKg: number;
  canSeeMoney: boolean;
  canManageCatalog: boolean;
  canOperate: boolean;
  materialCostPerGram: Record<string, number>;
};

export async function listSpools(options?: {
  material?: string;
  includeInactive?: boolean;
  onlyLow?: boolean;
}): Promise<SpoolsDirectoryView> {
  const { centerId, role } = await requireAuthContext();
  const canSeeMoney = role === "OWNER" || role === "ADMIN";
  const canManageCatalog = role === "OWNER" || role === "ADMIN";
  const canOperate = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";

  const [settings, rows] = await Promise.all([
    getCenterSettings(),
    prisma.spool.findMany({
      where: {
        centerId,
        ...(options?.includeInactive ? {} : { active: true }),
        ...(options?.material && options.material !== "ALL" ? { material: options.material } : {}),
      },
      orderBy: [{ active: "desc" }, { remainingGrams: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const materialCostPerGram: Record<string, number> = {};
  for (const mat of ["PLA", "PETG", "ASA", "ABS", "TPU", "OTHER"]) {
    materialCostPerGram[mat] = computeMaterialCostPerGram(rows, mat, settings.defaultCostPerKg);
  }

  let spools: SpoolListItem[] = rows.map((s) => {
    const isLow = s.active && s.remainingGrams <= settings.lowSpoolThresholdGrams;
    const remainingPct = s.totalGrams > 0 ? Math.min(100, Math.round((s.remainingGrams / s.totalGrams) * 100)) : 0;
    return {
      id: s.id,
      material: s.material,
      color: s.color,
      brand: s.brand,
      totalGrams: s.totalGrams,
      remainingGrams: s.remainingGrams,
      pricePaid: canSeeMoney ? s.pricePaid : null,
      costPerGram: canSeeMoney && s.totalGrams > 0 ? Math.round((s.pricePaid / s.totalGrams) * 100) / 100 : null,
      purchasedOn: s.purchasedOn.toISOString().slice(0, 10),
      notes: s.notes,
      active: s.active,
      isLow,
      remainingPct,
    };
  });

  if (options?.onlyLow) {
    spools = spools.filter((s) => s.isLow);
  }

  return {
    spools,
    currency: settings.currency,
    lowSpoolThresholdGrams: settings.lowSpoolThresholdGrams,
    defaultCostPerKg: settings.defaultCostPerKg,
    canSeeMoney,
    canManageCatalog,
    canOperate,
    materialCostPerGram,
  };
}

export type SpoolDetailMovement = {
  id: string;
  kind: string;
  deltaGrams: number;
  resultingGrams: number;
  orderId: string | null;
  orderNumber: number | null;
  notes: string | null;
  actorName: string;
  createdAt: Date;
};

export type SpoolDetailView = SpoolListItem & {
  currency: string;
  lowSpoolThresholdGrams: number;
  canSeeMoney: boolean;
  canManageCatalog: boolean;
  canOperate: boolean;
  movements: SpoolDetailMovement[];
};

export async function getSpoolDetail(spoolId: string): Promise<SpoolDetailView | null> {
  const { centerId, role } = await requireAuthContext();
  const canSeeMoney = role === "OWNER" || role === "ADMIN";
  const canManageCatalog = role === "OWNER" || role === "ADMIN";
  const canOperate = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";

  const [settings, spool] = await Promise.all([
    getCenterSettings(),
    prisma.spool.findFirst({
      where: { id: spoolId, centerId },
      include: {
        movements: {
          include: {
            order: { select: { id: true, number: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  if (!spool) return null;

  const actorIds = [...new Set(spool.movements.map((m) => m.actorUserId))];
  const profiles =
    actorIds.length > 0
      ? await prisma.profile.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p.displayName ?? "Integrante"]));

  const isLow = spool.active && spool.remainingGrams <= settings.lowSpoolThresholdGrams;
  const remainingPct =
    spool.totalGrams > 0 ? Math.min(100, Math.round((spool.remainingGrams / spool.totalGrams) * 100)) : 0;

  return {
    id: spool.id,
    material: spool.material,
    color: spool.color,
    brand: spool.brand,
    totalGrams: spool.totalGrams,
    remainingGrams: spool.remainingGrams,
    pricePaid: canSeeMoney ? spool.pricePaid : null,
    costPerGram:
      canSeeMoney && spool.totalGrams > 0 ? Math.round((spool.pricePaid / spool.totalGrams) * 100) / 100 : null,
    purchasedOn: spool.purchasedOn.toISOString().slice(0, 10),
    notes: spool.notes,
    active: spool.active,
    isLow,
    remainingPct,
    currency: settings.currency,
    lowSpoolThresholdGrams: settings.lowSpoolThresholdGrams,
    canSeeMoney,
    canManageCatalog,
    canOperate,
    movements: spool.movements.map((m) => ({
      id: m.id,
      kind: m.kind,
      deltaGrams: m.deltaGrams,
      resultingGrams: m.resultingGrams,
      orderId: m.order?.id ?? null,
      orderNumber: m.order?.number ?? null,
      notes: m.notes,
      actorName: profileMap.get(m.actorUserId) ?? "Integrante",
      createdAt: m.createdAt,
    })),
  };
}
