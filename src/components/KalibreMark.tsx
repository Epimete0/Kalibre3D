/**
 * Isotipo oficial de Kalibre 3D (Opción 1C · Escala y Precisión):
 * fusiona una regla graduada de pie de rey, un riel central azul eléctrico
 * y la letra K formada por el carro y las mordazas.
 */
export function KalibreMark({
  size = "md",
  tone = "default",
}: {
  size?: "sm" | "md" | "lg";
  tone?: "default" | "dark";
}) {
  const boxSize =
    size === "sm"
      ? "h-6 w-6 rounded-md"
      : size === "lg"
        ? "h-8 w-8 rounded-lg"
        : "h-7 w-7 rounded-lg";

  const svgSize =
    size === "sm"
      ? "h-4 w-4"
      : size === "lg"
        ? "h-5.5 w-5.5"
        : "h-[19px] w-[19px]";

  const surface =
    tone === "dark"
      ? "border-[#3a3d47] bg-[#26282e] text-[#f5f2eb]"
      : "border-[#2a2c33] bg-[#1c1d21] text-[#f5f2eb]";

  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center border shadow-[0_1px_2px_rgba(28,29,33,0.14)] ${boxSize} ${surface}`}
    >
      <svg viewBox="0 0 32 32" fill="none" className={svgSize}>
        {/* Regla milimétrica izquierda con muesca superior de calibre */}
        <path
          d="M8.5 4.5H11.5V27.5H8.5V21.5H10V20.2H8.5V17.4H10V16.1H8.5V13.3H10V12H8.5V9.2L4.2 6.8H8.5V4.5Z"
          fill="currentColor"
        />
        {/* Riel vernier central azul eléctrico */}
        <rect x="13" y="4.5" width="2.4" height="23" fill="#3b82f6" />
        {/* Mordaza superior biselada */}
        <path d="M17 4.5H20.4L27.6 9.3H17V4.5Z" fill="currentColor" />
        {/* Carro corredero integrado formando la K */}
        <path
          d="M17 11H19.7V17.6L24.1 11H27.6L22.1 19.25L27.6 27.5H24.1L19.7 20.9V27.5H17V11Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
