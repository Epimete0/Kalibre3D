import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { requireSessionUser } from "@/lib/auth";
import { MAX_OWNED_CENTERS, countOwnedCenters } from "@/lib/center-creation";
import { prisma } from "@/lib/prisma";
import { CreateCenterForm } from "./CreateCenterForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crea tu taller — Kalibre" };

export default async function NewCenterPage() {
  const userId = await requireSessionUser();
  // Quien ya tiene su taller no vuelve a esta pantalla: sigue en Inicio.
  if ((await countOwnedCenters(prisma, userId)) >= MAX_OWNED_CENTERS) redirect("/dashboard");

  return (
    <AuthLayout>
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8">
        <h1 className="text-3xl text-ink">Crea tu taller</h1>
        <p className="mt-2 text-sm text-muted">Dos datos y listo: después podrás registrar tus pedidos, tu dinero y tu filamento.</p>
        <CreateCenterForm centerId={randomUUID()} />
        <p className="mt-5 text-sm text-muted">¿Te invitaron a un taller? <Link href="/join" className="font-medium text-primary underline-offset-2 hover:underline">Usa tu código de invitación</Link>.</p>
      </div>
    </AuthLayout>
  );
}
