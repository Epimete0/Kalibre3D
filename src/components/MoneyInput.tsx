"use client";

import { useRef } from "react";
import { inputClass } from "@/components/ui";
import { formatThousands, parseMoneyDigits } from "@/lib/money-input";

export { formatThousands, parseMoneyDigits };

function countDigitsBeforeCaret(value: string, caret: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(caret, value.length); i++) {
    if (/\d/.test(value[i]!)) count++;
  }
  return count;
}

function caretPositionForDigits(formatted: string, targetDigits: number): number {
  if (targetDigits <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen++;
      if (seen === targetDigits) return i + 1;
    }
  }
  return formatted.length;
}

type MoneyInputProps = {
  id?: string;
  name?: string;
  value: number | string;
  onChangeValue: (digits: string, numericValue: number) => void;
  allowZeroDisplay?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Campo numérico entero que formatea con separador de miles (ej. 10.000) mientras
 * se escribe, manteniendo teclado numérico en móvil, enviando dígitos limpios cuando
 * se pasa `name` y preservando la posición del cursor.
 */
export function MoneyInput({
  id,
  name,
  value,
  onChangeValue,
  allowZeroDisplay = false,
  placeholder = "0",
  required,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const rawString =
    typeof value === "number"
      ? value === 0 && !allowZeroDisplay
        ? ""
        : String(Math.max(0, Math.round(value)))
      : value;
  const normalizedDigits = parseMoneyDigits(rawString).replace(/^0+(?=\d)/, "");
  const displayValue =
    normalizedDigits === "0" && !allowZeroDisplay
      ? ""
      : formatThousands(normalizedDigits);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const digitsBefore = countDigitsBeforeCaret(raw, caret);

    const digits = parseMoneyDigits(raw).replace(/^0+(?=\d)/, "");
    const formatted = formatThousands(digits);
    const num = digits ? Number(digits) : 0;

    onChangeValue(digits, Number.isFinite(num) ? num : 0);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el || document.activeElement !== el) return;
      const nextPos = caretPositionForDigits(formatted, digitsBefore);
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  return (
    <>
      {name && (
        <input
          type="hidden"
          name={name}
          value={normalizedDigits === "" && allowZeroDisplay ? "0" : normalizedDigits}
        />
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        className={`${inputClass} tabular-nums ${className}`}
      />
    </>
  );
}
