import Link from "next/link";
import { EmptyState } from "@/components/ui";

/**
 * Página «no encontrado» de toda el área privada (Clientas, Productos, Proveedores…): en español y dentro de la aplicación.
 * Agenda tiene la suya, más específica. Un recurso de otro taller se ve igual que uno inexistente: no se revela que existe.
 */
export default function PrivateNotFound() {
  return (
    <EmptyState title="No encontramos lo que buscas" description="Puede que ya no exista o que pertenezca a otro taller.">
      <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line bg-raised px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation">Ir al inicio</Link>
    </EmptyState>
  );
}
