import { AuthForm } from "@/components/AuthForm";
import { AuthLayout } from "@/components/AuthLayout";
import { loginAction, signupAction } from "../login/actions";

export const metadata = { title: "Crea tu cuenta — Kalibre" };

/** Acceso directo al registro desde la landing: es el mismo formulario de `/login`, abierto en «crear cuenta». */
export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthForm loginAction={loginAction} signupAction={signupAction} initialMode="signup" />
    </AuthLayout>
  );
}
