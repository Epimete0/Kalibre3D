"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import { toMinorUnits } from "@/lib/money-format";
import {
  createSpool,
  recordSpoolMovement,
  setSpoolActive,
  updateSpool,
  type CreateSpoolInput,
  type RecordSpoolMovementInput,
  type UpdateSpoolInput,
} from "@/lib/spool-service";

export type SpoolActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function createSpoolAction(
  _prevState: SpoolActionState,
  formData: FormData
): Promise<SpoolActionState> {
  const currency = String(formData.get("currency") ?? "CLP");
  const rawPrice = String(formData.get("pricePaid") ?? "0").trim();
  const parsedPrice = rawPrice === "" ? 0 : toMinorUnits(rawPrice, currency);

  if (parsedPrice === null || parsedPrice < 0) {
    return { error: "Ingresa un precio pagado válido mayor o igual a 0." };
  }

  const rawRemaining = String(formData.get("remainingGrams") ?? "").trim();

  try {
    await createSpool({
      operationId: String(formData.get("operationId") ?? ""),
      material: String(formData.get("material") ?? "PETG") as CreateSpoolInput["material"],
      color: String(formData.get("color") ?? ""),
      brand: String(formData.get("brand") ?? "") || null,
      totalGrams: Number(formData.get("totalGrams") ?? 1000),
      remainingGrams: rawRemaining ? Number(rawRemaining) : undefined,
      pricePaid: parsedPrice,
      purchasedOn: String(formData.get("purchasedOn") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || null,
      recordExpenseInMoney: formData.get("recordExpenseInMoney") === "on" || formData.get("recordExpenseInMoney") === "true",
      paymentMethod: (String(formData.get("paymentMethod") ?? "TRANSFER") as CreateSpoolInput["paymentMethod"]) ?? "TRANSFER",
    });

    revalidatePath("/spools");
    revalidatePath("/money");
    revalidatePath("/dashboard");
    revalidatePath("/quote");
    return { ok: true, message: "Bobina registrada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible registrar la bobina. Intenta nuevamente.");
  }
}

export async function updateSpoolAction(
  _prevState: SpoolActionState,
  formData: FormData
): Promise<SpoolActionState> {
  const spoolId = String(formData.get("id") ?? "");
  const currency = String(formData.get("currency") ?? "CLP");
  const rawPrice = String(formData.get("pricePaid") ?? "0").trim();
  const parsedPrice = rawPrice === "" ? 0 : toMinorUnits(rawPrice, currency);

  if (parsedPrice === null || parsedPrice < 0) {
    return { error: "Ingresa un precio pagado válido mayor o igual a 0." };
  }

  try {
    await updateSpool({
      id: spoolId,
      material: String(formData.get("material") ?? "PETG") as UpdateSpoolInput["material"],
      color: String(formData.get("color") ?? ""),
      brand: String(formData.get("brand") ?? "") || null,
      totalGrams: Number(formData.get("totalGrams") ?? 1000),
      pricePaid: parsedPrice,
      purchasedOn: String(formData.get("purchasedOn") ?? ""),
      notes: String(formData.get("notes") ?? "") || null,
    });

    revalidatePath("/spools");
    revalidatePath(`/spools/${spoolId}`);
    revalidatePath("/quote");
    return { ok: true, message: "Bobina actualizada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar la bobina. Intenta nuevamente.");
  }
}

export async function toggleSpoolActiveAction(input: {
  id: string;
  active: boolean;
}): Promise<SpoolActionState> {
  try {
    await setSpoolActive(input);
    revalidatePath("/spools");
    revalidatePath(`/spools/${input.id}`);
    revalidatePath("/quote");
    return {
      ok: true,
      message: input.active ? "Bobina reactivada correctamente." : "Bobina desactivada correctamente.",
    };
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el estado de la bobina. Intenta nuevamente.");
  }
}

export async function recordSpoolMovementAction(input: {
  operationId: string;
  spoolId: string;
  kind: "CONSUME" | "ADJUST";
  deltaGrams: number;
  notes?: string;
}): Promise<SpoolActionState> {
  try {
    await recordSpoolMovement({
      operationId: input.operationId,
      spoolId: input.spoolId,
      kind: input.kind as RecordSpoolMovementInput["kind"],
      deltaGrams: input.deltaGrams,
      notes: input.notes ?? null,
    });

    revalidatePath("/spools");
    revalidatePath(`/spools/${input.spoolId}`);
    revalidatePath("/dashboard");
    return {
      ok: true,
      message:
        input.kind === "CONSUME"
          ? "Consumo de filamento registrado correctamente."
          : "Ajuste de gramos registrado correctamente.",
    };
  } catch (error) {
    return actionFailure(error, "No fue posible registrar el movimiento de filamento. Intenta nuevamente.");
  }
}
