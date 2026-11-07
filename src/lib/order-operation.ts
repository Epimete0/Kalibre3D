import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOperationalContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ResolveDependencies = { newOperationId?: () => string };

export async function resolveNewOrderOperation(
  candidate: string | undefined,
  dependencies: ResolveDependencies = {}
) {
  const newOperationId = dependencies.newOperationId ?? randomUUID;
  if (!candidate || !z.string().uuid().safeParse(candidate).success) {
    return { kind: "NEW" as const, operationId: newOperationId(), redirect: true };
  }

  const { centerId, userId } = await requireOperationalContext();
  const order = await prisma.order.findUnique({
    where: { centerId_operationId: { centerId, operationId: candidate } },
    select: { id: true, createdByUserId: true },
  });

  if (!order) return { kind: "NEW" as const, operationId: candidate, redirect: false };
  if (order.createdByUserId === userId) return { kind: "EXISTING_OWN" as const, orderId: order.id };
  return { kind: "FOREIGN" as const, operationId: newOperationId() };
}
