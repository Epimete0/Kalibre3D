import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { JoinInvitationForm } from "@/components/JoinInvitationForm";

export default function JoinPage() { return <AuthLayout><div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8"><h1 className="text-3xl text-ink">Únete a un taller</h1><p className="mt-2 text-sm text-muted">Ingresa el código que te compartió quien administra el taller.</p><JoinInvitationForm /><Link href="/login" className="mt-5 inline-block text-sm text-muted hover:text-ink">Volver a iniciar sesión</Link></div></AuthLayout>; }
