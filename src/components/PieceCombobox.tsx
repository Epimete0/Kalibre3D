"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, inputClass } from "@/components/ui";
import { MATERIAL_LABEL, type Material } from "@/lib/catalog-presentation";
import { formatMoney } from "@/lib/money-format";
import type { ProductListItem } from "@/lib/product-queries";

type PieceComboboxProps = {
  id: string;
  products: ProductListItem[];
  selectedProductId: string | null;
  value: string;
  unitPriceForProduct: (product: ProductListItem) => number;
  currency: string;
  placeholder?: string;
  required?: boolean;
  onSelectProduct: (product: ProductListItem) => void;
  onManualTextChange: (nextText: string) => void;
  onClearProduct: () => void;
};

/**
 * Buscador único de piezas por línea de venta: filtra el catálogo en tiempo real
 * por nombre, categoría o material y también permite escribir una pieza manual libre.
 */
export function PieceCombobox({
  id,
  products,
  selectedProductId,
  value,
  unitPriceForProduct,
  currency,
  placeholder = "Buscar pieza o escribir manual…",
  required = true,
  onSelectProduct,
  onManualTextChange,
  onClearProduct,
}: PieceComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Cuando ya hay una pieza vinculada y la persona hace foco sin editar todavía, mostramos el catálogo completo para facilitar cambiarla.
  const [showAllWhileLinked, setShowAllWhileLinked] = useState(false);

  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter((p) => p.active);
    const list = activeProducts.length > 0 ? activeProducts : products;
    if (showAllWhileLinked) return list.slice(0, 25);

    const query = value.trim().toLowerCase();
    if (!query) return list.slice(0, 25);

    return list
      .filter((p) => {
        const mat = MATERIAL_LABEL[p.material as Material] ?? p.material;
        return (
          p.name.toLowerCase().includes(query) ||
          (p.category ?? "").toLowerCase().includes(query) ||
          mat.toLowerCase().includes(query)
        );
      })
      .slice(0, 25);
  }, [products, value, showAllWhileLinked]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowAllWhileLinked(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleSelect = (product: ProductListItem) => {
    onSelectProduct(product);
    setOpen(false);
    setShowAllWhileLinked(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp") && products.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredProducts.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? filteredProducts.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter" && activeIndex >= 0 && filteredProducts[activeIndex]) {
      e.preventDefault();
      handleSelect(filteredProducts[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setShowAllWhileLinked(false);
      setActiveIndex(-1);
    }
  };

  const listboxId = `${id}-listbox`;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open && products.length > 0}
          aria-controls={products.length > 0 ? listboxId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            if (products.length > 0) {
              setShowAllWhileLinked(Boolean(selectedProductId));
              setOpen(true);
            }
          }}
          onChange={(e) => {
            setShowAllWhileLinked(false);
            onManualTextChange(e.target.value);
            if (products.length > 0) {
              setOpen(true);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          className={`${inputClass} ${products.length > 0 ? "pr-16" : ""}`}
        />

        {products.length > 0 && (
          <div className="absolute right-1.5 flex items-center gap-0.5">
            {(selectedProductId || value.length > 0) && (
              <button
                type="button"
                title="Limpiar y escribir otra pieza"
                aria-label="Limpiar pieza"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onClearProduct();
                  setShowAllWhileLinked(false);
                  setOpen(true);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-muted hover:bg-raised hover:text-ink transition-colors"
              >
                ×
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              aria-label={open ? "Cerrar catálogo" : "Abrir catálogo"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (open) {
                  setOpen(false);
                  setShowAllWhileLinked(false);
                } else {
                  setShowAllWhileLinked(Boolean(selectedProductId));
                  setOpen(true);
                  inputRef.current?.focus();
                }
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs text-muted hover:bg-raised hover:text-ink transition-colors"
            >
              {open ? "▲" : "▼"}
            </button>
          </div>
        )}
      </div>

      {open && products.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="popover-enter origin-top absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-[0_12px_28px_rgba(28,29,33,0.14)]"
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((p, index) => {
              const isSelected = p.id === selectedProductId;
              const isHighlighted = index === activeIndex;
              const matLabel = MATERIAL_LABEL[p.material as Material] ?? p.material;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(p)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isHighlighted || isSelected
                      ? "bg-raised text-ink"
                      : "text-ink hover:bg-raised/70"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">
                        {p.name}
                      </span>
                      {p.category && (
                        <span className="hidden sm:inline shrink-0 text-[11px] text-muted">
                          · {p.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span>
                        {matLabel}
                        {p.grams > 0 ? ` · ${p.grams} g` : ""}
                      </span>
                      <Badge
                        tone={
                          p.currentStock <= 0
                            ? "warn"
                            : p.isLowStock
                              ? "warn"
                              : "ok"
                        }
                      >
                        {p.currentStock <= 0 ? "Sin stock" : `Stock: ${p.currentStock}`}
                      </Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink tabular-nums">
                    {formatMoney(unitPriceForProduct(p), currency)}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-muted">
              No hay coincidencias en tu catálogo. Se registrará como{" "}
              <strong className="text-ink">pieza manual</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
