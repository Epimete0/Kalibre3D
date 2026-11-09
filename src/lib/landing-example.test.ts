// La landing muestra un ejemplo de costeo (Pedido #42). Esta prueba amarra sus cifras a las reglas reales
// de src/lib/costing.ts para que el texto de marketing no vuelva a descuadrarse del cotizador.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computePieceCost, mercadoLibreNet } from "./costing";
import { formatMoney } from "./money-format";

const clp = (value: number) => formatMoney(value, "CLP");

describe("ejemplo de costeo de la landing", () => {
  it("las cifras publicadas coinciden con el cotizador", async () => {
    const page = await readFile(path.join(process.cwd(), "src/app/page.tsx"), "utf8");

    // 50 g de pieza + 14 g de purga bicolor, PETG a $15.000/kg; luz + embalaje = $145.
    const cost = computePieceCost({ grams: 50, colorsCount: 2, purgeGrams: 14, costPerGram: 15, printMinutes: 0, electricityCostPerHour: 0, packagingCost: 145 });
    const ml = mercadoLibreNet({ salePrice: 8990, commissionPct: 19, sellerShippingCost: 799 });

    expect(cost.totalGrams).toBe(64);
    expect(page).toContain(`>${clp(cost.materialCost)}<`);
    expect(page).toContain(`>${clp(cost.totalCost)}<`);
    expect(page).toContain(`>−${clp(cost.totalCost)}<`);
    expect(page).toContain(`>${clp(ml.net)}<`);
    expect(page).toContain(`>+${clp(6500 - cost.totalCost)}<`);
    expect(page).toContain(`>+${clp(ml.net - cost.totalCost)}<`);
  });
});

describe("ejemplo del cotizador público en la landing", () => {
  it("el llavero con NFC coincide con el cotizador público", async () => {
    const { computePublicQuote } = await import("./public-quote");
    const page = await readFile(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    // 12 g de PETG a $15.000/kg, 20 min a 150 W y $260/kWh, $450 de insumos, margen 70 %.
    const r = computePublicQuote({
      filamentPricePerKg: 15000, grams: 12, colorsCount: 1, purgeGrams: 0, printMinutes: 20, kwhPrice: 260, printerWatts: 150,
      sparePartsCost: 0, machineLifeHours: 0, failurePercent: 0, suppliesCost: 450, packagingCost: 0, marginPercent: 70,
      vatPercent: 0, extraCommissionPercent: 0, mlCommissionPercent: 0, mlShippingCost: 0,
    });
    for (const value of [r.material, r.electricity, r.supplies, r.totalCost]) expect(page).toContain(`"${clp(value)}"`);
    expect(page).toContain(`>${clp(r.directPrice)}<`);
    expect(page).toContain(`Te quedan ${clp(r.profit)} limpios`);
  });
});
