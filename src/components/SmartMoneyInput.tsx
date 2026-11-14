"use client";

import { MoneyInput } from "@/components/MoneyInput";
import { inputClass } from "@/components/ui";
import { currencyDecimals } from "@/lib/money-format";

type SmartMoneyInputProps = {
  id?: string;
  currency: string;
  value: string;
  onChangeValue: (rawDigitsOrDecimal: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowZeroDisplay?: boolean;
  integerOnly?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Muestra separador de miles en vivo (1000 → 1.000) para monedas enteras (CLP, PYG),
 * y permite decimales (o enteros puros en ajustes) cuando la moneda usa centavos.
 */
export function SmartMoneyInput({
  id,
  currency,
  value,
  onChangeValue,
  placeholder,
  required,
  disabled,
  allowZeroDisplay = false,
  integerOnly = false,
  className,
  "aria-label": ariaLabel,
}: SmartMoneyInputProps) {
  if (currencyDecimals(currency) === 0) {
    return (
      <MoneyInput
        id={id}
        value={value}
        onChangeValue={(digits) => onChangeValue(digits)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        allowZeroDisplay={allowZeroDisplay}
        className={className}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <input
      id={id}
      type="number"
      inputMode={integerOnly ? "numeric" : "decimal"}
      min="0"
      step={integerOnly ? "1" : "0.01"}
      value={value}
      onChange={(e) => onChangeValue(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className ?? inputClass}
    />
  );
}
