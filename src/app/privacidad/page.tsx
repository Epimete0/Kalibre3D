import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad — Kalibre", description: "Qué datos trata Kalibre, para qué, quién puede verlos y cómo ejercer tus derechos." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" intro="Aquí te contamos qué datos trata Kalibre, para qué, quién puede verlos y cómo puedes ejercer tus derechos. Si algo no queda claro, escríbenos.">
      <section><h2>1. Qué datos tratamos</h2>
        <ul>
          <li><strong>De tu cuenta:</strong> tu correo, tu nombre y tu contraseña (que se guarda cifrada, nunca en texto legible).</li>
          <li><strong>De tu taller:</strong> su nombre, zona horaria, equipo, catálogo de piezas, bobinas de filamento, pedidos, ventas por distintos canales, ingresos, gastos y costos.</li>
          <li><strong>De los clientes de tu taller:</strong> lo que tu taller decide registrar, como nombre, teléfono, correo, dirección de entrega y notas de pedidos. Estos datos son de tu taller; Kalibre los guarda para ti.</li>
          <li><strong>Técnicos:</strong> registros mínimos del servidor para seguridad y para detectar errores.</li>
        </ul>
      </section>
      <section><h2>2. Para qué los usamos</h2><p>Para darte el servicio (que puedas entrar, que tu equipo trabaje y que tus datos se muestren en tu taller), mantenerlo seguro, resolver problemas y avisarte de cambios importantes. No los usamos para publicidad ni los vendemos.</p></section>
      <section><h2>3. Quién puede ver los datos</h2>
        <ul>
          <li>Solo las personas de tu mismo taller, y cada una según su rol: por ejemplo, los costos y la utilidad los ven solo el dueño y el administrador (el ayudante y quien tiene rol de solo consulta no acceden a esos datos).</li>
          <li>Los datos de un taller nunca se muestran a otro taller.</li>
          <li>Trabajamos con proveedores que nos permiten operar: <strong>Supabase</strong> (base de datos y autenticación) y <strong>Vercel</strong> (alojamiento de la aplicación). Tratan los datos solo para prestarnos ese servicio. Pueden almacenar información fuera de Chile.</li>
        </ul>
      </section>
      <section><h2>4. Cookies y almacenamiento en tu navegador</h2><p>Usamos solo lo necesario para que Kalibre funcione: cookies de tu sesión y del taller que tienes activo, y almacenamiento local para recordar tu tema (claro u oscuro) y guardar borradores de formularios, que se eliminan al cerrar sesión o a los 7 días. No usamos cookies de publicidad ni de analítica de terceros.</p></section>
      <section><h2>5. Cuánto tiempo los conservamos</h2><p>Mientras tu taller esté activo. Los registros históricos (pedidos, ventas, movimientos de stock y de filamento) se conservan para que tus reportes y balances sean confiables. Tu taller puede dar de baja o anonimizar a un cliente cuando este lo pida. Si nos pides eliminar tu taller, borraremos o anonimizaremos sus datos, salvo lo que la ley nos obligue a conservar.</p></section>
      <section><h2>6. Tus derechos</h2><p>Según la normativa chilena de protección de datos personales, puedes pedir acceso a tus datos, que los corrijamos, que los eliminemos, oponerte a ciertos usos o solicitar su portabilidad. Si eres cliente de un taller que usa Kalibre, tu solicitud debe dirigirse primero a ese taller, porque es quien decide qué datos tuyos registra.</p></section>
      <section><h2>7. Seguridad</h2><p>Protegemos los datos con conexiones cifradas, contraseñas cifradas, aislamiento entre talleres y roles que se verifican en el servidor, no solo en la pantalla. Ningún sistema es infalible: si detectamos un incidente que te afecte, te avisaremos.</p></section>
      <section><h2>8. Menores de edad</h2><p>Kalibre es una herramienta de trabajo para talleres y no está dirigida a menores de 18 años.</p></section>
      <section><h2>9. Cambios en esta política</h2><p>Si la actualizamos de forma importante, cambiaremos la fecha de la versión y te lo avisaremos. Los <Link href="/terminos">Términos de uso</Link> complementan este documento.</p></section>
    </LegalPage>
  );
}
