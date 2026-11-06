import { AuthForm } from "@/components/AuthForm";
import { AuthLayout } from "@/components/AuthLayout";
import { loginAction, signupAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthLayout>
      {error === "link_expired" ? <p className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">El enlace de confirmación o recuperación venció. Solicita uno nuevo.</p> : null}
      <AuthForm loginAction={loginAction} signupAction={signupAction} />
    </AuthLayout>
  );
}
