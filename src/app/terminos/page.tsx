import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Términos de uso — Taller 3D", description: "Las reglas para usar Taller 3D, el sistema de gestión para makers y talleres de impresión 3D." };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso" intro="Estas son las reglas para usar Taller 3D. Están escritas en lenguaje simple: al crear tu cuenta aceptas lo que dicen, así que léelas con calma.">
      <section><h2>1. Qué es Taller 3D</h2><p>Taller 3D es un sistema en línea para la operación interna de makers y talleres de impresión 3D: pedidos, clientes del taller, ventas (por WhatsApp, Instagram, Mercado Libre o en persona), dinero, costos de piezas y filamento. Lo usas desde el navegador, con tu cuenta personal.</p></section>
      <section><h2>2. Tu cuenta y tu taller</h2>
        <ul>
          <li>Para usar Taller 3D creas una cuenta con tu correo y una contraseña. Eres responsable de mantenerla en secreto y de lo que se haga con ella.</li>
          <li>Cada persona puede crear un taller propio. Quien lo crea queda como dueño del taller, con todos los permisos, y puede invitar a su equipo con códigos de invitación.</li>
          <li>Quien administra el taller decide qué rol tiene cada integrante (dueño, administrador, ayudante o solo consulta) y qué ve cada uno (solo el dueño y el administrador tienen acceso a costos y utilidad). Es responsable de dar y quitar accesos.</li>
        </ul>
      </section>
      <section><h2>3. Uso aceptable</h2><p>Usa Taller 3D solo para gestionar tu taller. No puedes intentar acceder a datos de otros talleres, interferir con el funcionamiento del servicio, usarlo para enviar spam o para fines ilegales, ni compartir tu cuenta con personas ajenas a tu equipo.</p></section>
      <section><h2>4. Los datos de tus clientes</h2>
        <p>Cuando cargas datos de los clientes de tu taller (nombre, contacto, dirección de entrega o notas de pedidos), tu taller es quien responde ante ellos por ese tratamiento. Debes contar con su autorización o con otra base legal para tenerlos, y mantenerlos exactos y al día.</p>
        <p>Taller 3D los trata solo para prestarte el servicio y siguiendo tus instrucciones. Los detalles están en la <Link href="/privacidad">Política de Privacidad</Link>.</p>
      </section>
      <section><h2>5. Tus cálculos y tus decisiones</h2><p>El costo estimado por pieza, el consumo de filamento, el costo promedio del material, las comisiones de canales de venta, la utilidad calculada y los cotizadores son una ayuda para decidir, calculada con los datos que tú cargas. Si esos datos están incompletos o equivocados, los resultados también lo estarán. Las decisiones de precios, compras y operación son siempre tuyas.</p></section>
      <section><h2>6. Disponibilidad</h2><p>Trabajamos para que Taller 3D esté disponible y tus datos estén seguros, pero no podemos garantizar que funcione sin interrupciones ni errores. Podemos hacer mantenciones y mejoras que afecten temporalmente el servicio.</p></section>
      <section><h2>7. Planes y pagos</h2><p>Los planes, precios y formas de pago, cuando existan, se informarán antes de contratarlos. No se hará ningún cobro sin que lo hayas aceptado.</p></section>
      <section><h2>8. Tus datos son tuyos</h2><p>La información que cargas en Taller 3D sigue siendo de tu taller. No la vendemos ni la usamos para publicidad. Puedes pedirnos que archivemos o eliminemos tu taller y sus datos; lo haremos salvo que la ley nos obligue a conservar algo.</p></section>
      <section><h2>9. Responsabilidad</h2><p>Taller 3D se ofrece «tal como está». En lo que permita la ley, no respondemos por pérdidas indirectas, por lucro cesante ni por decisiones tomadas con base en los datos o cálculos del sistema. Esto no limita derechos que la ley te reconozca como persona consumidora.</p></section>
      <section><h2>10. Suspensión y término</h2><p>Puedes dejar de usar Taller 3D cuando quieras. Podemos suspender una cuenta que incumpla estos términos o ponga en riesgo la seguridad del servicio o de otros talleres, avisándote cuando sea posible.</p></section>
      <section><h2>11. Cambios en estos términos</h2><p>Si cambiamos estos términos de forma importante, actualizaremos la fecha de la versión y te pediremos aceptarlos de nuevo. El uso del servicio después de un cambio menor implica que lo aceptas.</p></section>
      <section><h2>12. Ley aplicable</h2><p>Estos términos se rigen por las leyes de Chile. Cualquier controversia se resolverá ante los tribunales competentes de ese país, sin perjuicio de los derechos que la ley te otorgue.</p></section>
    </LegalPage>
  );
}
