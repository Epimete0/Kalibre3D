import { describe, expect, it } from "vitest";
import { canTransition, isFinalStatus, nextStatuses } from "./order-status";

describe("estados de venta", () => {
  it("sigue cotizado → confirmado → imprimiendo → listo → entregado, y cancela antes de entregar", () => {
    expect(nextStatuses("QUOTED")).toEqual(["CONFIRMED", "CANCELED"]);
    expect(nextStatuses("CONFIRMED")).toEqual(["PRINTING", "CANCELED"]);
    expect(nextStatuses("PRINTING")).toEqual(["READY", "CANCELED"]);
    expect(nextStatuses("READY")).toEqual(["DELIVERED", "CANCELED"]);
  });

  it("solo una venta entregada se devuelve; cancelada y devuelta son finales", () => {
    expect(nextStatuses("DELIVERED")).toEqual(["RETURNED"]);
    expect(canTransition("READY", "RETURNED")).toBe(false);
    expect(isFinalStatus("CANCELED")).toBe(true);
    expect(isFinalStatus("RETURNED")).toBe(true);
    expect(nextStatuses("CANCELED")).toEqual([]);
  });

  it("no permite saltarse pasos", () => {
    expect(canTransition("QUOTED", "DELIVERED")).toBe(false);
  });
});
