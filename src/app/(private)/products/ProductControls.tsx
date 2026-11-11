"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useId, useState, useTransition } from "react";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { MATERIALS, MATERIAL_LABEL } from "@/lib/catalog-presentation";
import { computePieceCost, mercadoLibreNet } from "@/lib/costing";
import { formatMoney } from "@/lib/money-format";
import type { ProductListItem } from "@/lib/product-queries";
import {
  createProductAction,
  deleteProductAction,
  recordProductMovementAction,
  setProductActiveAction,
  updateProductAction,
  type ProductActionState,
} from "./actions";

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const dangerBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:opacity-60";

export type CatalogSettingsSummary = {
  currency: string;
  electricityCostPerHour: number;
  defaultPackagingCost: number;
  defaultPurgeGrams: number;
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
  materialCostPerGram: Record<string, number>;
};

function Feedback({ state }: { state: ProductActionState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-xs text-ok">
        {state.message}
      </p>
    );
  return null;
}

export function CreateProductBar({
  currency,
  defaultPurgeGrams = 0,
  sellsOnMercadoLibre = true,
}: {
  currency: string;
  defaultPurgeGrams?: number;
  /** Si el taller no vende por Mercado Libre (perfil), no se pide precio ML. */
  sellsOnMercadoLibre?: boolean;
}) {
  const [state, run, pending] = useActionState(createProductAction, {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [mlPrice, setMlPrice] = useState("");
  const [category, setCategory] = useState("");
  const [material, setMaterial] = useState("PETG");
  const [grams, setGrams] = useState("");
  const [printMinutes, setPrintMinutes] = useState("");
  const [colorsCount, setColorsCount] = useState("1");
  const [purgeGrams, setPurgeGrams] = useState(String(defaultPurgeGrams));
  const [initialStock, setInitialStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [seen, setSeen] = useState(state);

  const nameId = useId();
  const salePriceId = useId();
  const mlPriceId = useId();

  if (state !== seen) {
    setSeen(state);
    if (state.message) {
      setName("");
      setSalePrice("");
      setMlPrice("");
      setCategory("");
      setGrams("");
      setPrintMinutes("");
      setColorsCount("1");
      setInitialStock("0");
      setMinStock("0");
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.set("name", name);
    data.set("salePrice", salePrice);
    data.set("mlPrice", mlPrice);
    data.set("category", category);
    data.set("material", material);
    data.set("grams", grams || "0");
    data.set("printMinutes", printMinutes || "0");
    data.set("colorsCount", colorsCount || "1");
    data.set("purgeGrams", purgeGrams || "0");
    data.set("initialStock", initialStock || "0");
    data.set("minStock", minStock || "0");
    startTransition(() => run(data));
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">Agregar pieza al catálogo</h2>
          <p className="mt-0.5 text-xs text-muted">
            Ingresa nombre y precio rápido, o despliega los datos de impresión y stock.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={secondaryBtn}
        >
          {showAdvanced ? "Ocultar gramos y stock" : "+ Gramos, tiempo y stock"}
        </button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 sm:items-end">
          <div className="sm:col-span-2 lg:col-span-5">
            <Field label="Nombre de la pieza" htmlFor={nameId}>
              <input
                id={nameId}
                required
                placeholder="Ej. Emblema Hilux 13x9"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-1 lg:col-span-3">
            <Field label={`Precio venta (${currency})`} htmlFor={salePriceId}>
              <input
                id={salePriceId}
                required
                type="number"
                min="0"
                step="1"
                placeholder="8990"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {sellsOnMercadoLibre && (
            <div className="sm:col-span-1 lg:col-span-2">
              <Field label="Precio en Mercado Libre (opcional)" htmlFor={mlPriceId}>
                <input
                  id={mlPriceId}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="10990"
                  value={mlPrice}
                  onChange={(e) => setMlPrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              disabled={pending || !name.trim() || !salePrice}
              className={`${primaryBtn} w-full min-h-11 sm:min-h-10`}
            >
              {pending ? "…" : "Agregar pieza"}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-line bg-raised/40 p-3.5 sm:p-4">
            <Field label="Categoría">
              <input
                placeholder="Ej. Emblemas"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Material">
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className={inputClass}
              >
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Peso pieza (g)">
              <input
                type="number"
                min="0"
                placeholder="50"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Tiempo (minutos)">
              <input
                type="number"
                min="0"
                placeholder="90"
                value={printMinutes}
                onChange={(e) => setPrintMinutes(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Colores (1–16)">
              <input
                type="number"
                min="1"
                max="16"
                value={colorsCount}
                onChange={(e) => setColorsCount(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Purga multicolor (g)">
              <input
                type="number"
                min="0"
                value={purgeGrams}
                onChange={(e) => setPurgeGrams(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Stock inicial">
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Alerta stock mínimo">
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </form>

      <div className="mt-3">
        <Feedback state={state} />
      </div>
    </Card>
  );
}

function useProductItemLogic(
  product: ProductListItem,
  costSummary?: CatalogSettingsSummary
) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editSalePrice, setEditSalePrice] = useState(String(product.salePrice));
  const [editMlPrice, setEditMlPrice] = useState(
    product.mlPrice !== null ? String(product.mlPrice) : ""
  );
  const [editCategory, setEditCategory] = useState(product.category ?? "");
  const [editMaterial, setEditMaterial] = useState(product.material);
  const [editGrams, setEditGrams] = useState(String(product.grams));
  const [editMinutes, setEditMinutes] = useState(String(product.printMinutes));
  const [editColors, setEditColors] = useState(String(product.colorsCount));
  const [editPurge, setEditPurge] = useState(String(product.purgeGrams));
  const [editMinStock, setEditMinStock] = useState(String(product.minStock));

  const [updateState, runUpdate, updatePending] = useActionState(
    updateProductAction,
    {}
  );
  const [, runToggle, togglePending] = useActionState(
    setProductActiveAction,
    {}
  );
  const [deleteState, runDelete, deletePending] = useActionState(
    deleteProductAction,
    {}
  );
  const [stockPending, startStockTransition] = useTransition();
  const [stockError, setStockError] = useState<string | null>(null);

  const pieceCost =
    costSummary && (product.grams > 0 || product.printMinutes > 0)
      ? computePieceCost({
          grams: product.grams,
          colorsCount: product.colorsCount,
          purgeGrams: product.purgeGrams,
          costPerGram: costSummary.materialCostPerGram[product.material] ?? 15,
          printMinutes: product.printMinutes,
          electricityCostPerHour: costSummary.electricityCostPerHour,
          packagingCost: costSummary.defaultPackagingCost,
        }).totalCost
      : null;

  const mlNet =
    costSummary && product.mlPrice !== null
      ? mercadoLibreNet({
          salePrice: product.mlPrice,
          commissionPct: costSummary.mlCommissionPercent,
          sellerShippingCost: costSummary.mlDefaultShippingCost,
        }).net
      : null;

  const handleQuickStock = (kind: "ENTRY" | "EXIT") => {
    setStockError(null);
    const opId = crypto.randomUUID();
    startStockTransition(async () => {
      const res = await recordProductMovementAction({
        operationId: opId,
        productId: product.id,
        kind,
        delta: 1,
        notes: kind === "ENTRY" ? "Fabricación rápida (+1)" : "Salida rápida (-1)",
      });
      if (res.error) {
        setStockError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.set("id", product.id);
    data.set("name", editName);
    data.set("salePrice", editSalePrice);
    data.set("mlPrice", editMlPrice);
    data.set("category", editCategory);
    data.set("material", editMaterial);
    data.set("grams", editGrams);
    data.set("printMinutes", editMinutes);
    data.set("colorsCount", editColors);
    data.set("purgeGrams", editPurge);
    data.set("minStock", editMinStock);
    startTransition(async () => {
      await runUpdate(data);
      setIsEditing(false);
    });
  };

  const handleToggleActive = () => {
    const data = new FormData();
    data.set("id", product.id);
    data.set("active", String(!product.active));
    startTransition(() => runToggle(data));
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    const data = new FormData();
    data.set("id", product.id);
    startTransition(() => runDelete(data));
  };

  const canBeDeleted = !product.hasOrders && !product.hasRealMovements;

  return {
    isEditing,
    setIsEditing,
    editName,
    setEditName,
    editSalePrice,
    setEditSalePrice,
    editMlPrice,
    setEditMlPrice,
    editCategory,
    setEditCategory,
    editMaterial,
    setEditMaterial,
    editGrams,
    setEditGrams,
    editMinutes,
    setEditMinutes,
    editColors,
    setEditColors,
    editPurge,
    setEditPurge,
    editMinStock,
    setEditMinStock,
    updateState,
    updatePending,
    togglePending,
    deleteState,
    deletePending,
    stockPending,
    stockError,
    pieceCost,
    mlNet,
    canBeDeleted,
    handleQuickStock,
    handleUpdate,
    handleToggleActive,
    handleDelete,
  };
}

/** Tarjeta móvil para visualización limpia en pantallas pequeñas sin scroll horizontal */
function ProductCardItem({
  product,
  currency,
  costSummary,
}: {
  product: ProductListItem;
  currency: string;
  costSummary?: CatalogSettingsSummary;
}) {
  const {
    isEditing,
    setIsEditing,
    editName,
    setEditName,
    editSalePrice,
    setEditSalePrice,
    editMlPrice,
    setEditMlPrice,
    editCategory,
    setEditCategory,
    editMaterial,
    setEditMaterial,
    editGrams,
    setEditGrams,
    editMinutes,
    setEditMinutes,
    editColors,
    setEditColors,
    editPurge,
    setEditPurge,
    editMinStock,
    setEditMinStock,
    updateState,
    updatePending,
    togglePending,
    deleteState,
    deletePending,
    stockPending,
    stockError,
    pieceCost,
    mlNet,
    canBeDeleted,
    handleQuickStock,
    handleUpdate,
    handleToggleActive,
    handleDelete,
  } = useProductItemLogic(product, costSummary);

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-surface p-4 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Editar pieza</h3>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs text-muted hover:text-ink font-semibold"
          >
            Cerrar ✕
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-3">
          <Field label="Nombre de la pieza">
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label={`Precio directo (${currency})`}>
              <input
                required
                type="number"
                min="0"
                value={editSalePrice}
                onChange={(e) => setEditSalePrice(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Precio en Mercado Libre">
              <input
                type="number"
                min="0"
                value={editMlPrice}
                onChange={(e) => setEditMlPrice(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Categoría">
              <input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Ej. Autos"
                className={inputClass}
              />
            </Field>
            <Field label="Material">
              <select
                value={editMaterial}
                onChange={(e) => setEditMaterial(e.target.value)}
                className={inputClass}
              >
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Gramos de pieza">
              <input
                type="number"
                min="0"
                value={editGrams}
                onChange={(e) => setEditGrams(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Minutos de impresión">
              <input
                type="number"
                min="0"
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Colores (1-16)">
              <input
                type="number"
                min="1"
                max="16"
                value={editColors}
                onChange={(e) => setEditColors(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Purga (g)">
              <input
                type="number"
                min="0"
                value={editPurge}
                onChange={(e) => setEditPurge(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Stock mín.">
              <input
                type="number"
                min="0"
                value={editMinStock}
                onChange={(e) => setEditMinStock(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2 pt-1.5">
            <button
              type="submit"
              disabled={updatePending}
              className={`${primaryBtn} flex-1 min-h-11`}
            >
              {updatePending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className={`${secondaryBtn} min-h-11 px-4`}
            >
              Cancelar
            </button>
          </div>
          {updateState.error ? (
            <p className="text-xs text-danger">{updateState.error}</p>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-4 space-y-3 transition-colors ${
        !product.active ? "opacity-60 bg-raised/20" : ""
      }`}
    >
      {/* Cabecera móvil: Nombre, badges y control de stock */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/products/${product.id}`}
              className="text-base font-bold text-ink hover:text-primary transition-colors hover:underline"
            >
              {product.name}
            </Link>
            {product.category && <Badge tone="neutral">{product.category}</Badge>}
            {!product.active && <Badge tone="warn">Inactiva</Badge>}
            {product.isLowStock && <Badge tone="warn">Stock bajo</Badge>}
          </div>

          <p className="text-xs text-muted">
            {MATERIAL_LABEL[product.material as keyof typeof MATERIAL_LABEL] ?? product.material}
            {product.grams > 0 ? ` · ${product.grams} g` : ""}
            {product.colorsCount > 1
              ? ` · ${product.colorsCount} col (+${product.purgeGrams}g purga)`
              : ""}
            {product.printMinutes > 0 ? ` · ${product.printMinutes} min` : ""}
          </p>
        </div>

        {/* Control táctil de stock */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Stock
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {product.active && (
              <button
                type="button"
                disabled={stockPending || product.currentStock <= 0}
                onClick={() => handleQuickStock("EXIT")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-raised text-sm font-bold text-ink active:scale-95 disabled:opacity-30 touch-manipulation hover:bg-canvas"
                title="Restar 1 unidad"
              >
                -
              </button>
            )}
            <span
              className={`min-w-6 text-center text-base font-bold tabular-nums ${
                product.isLowStock ? "text-warn" : "text-ink"
              }`}
            >
              {product.currentStock}
            </span>
            {product.active && (
              <button
                type="button"
                disabled={stockPending}
                onClick={() => handleQuickStock("ENTRY")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-raised text-sm font-bold text-ink active:scale-95 disabled:opacity-30 touch-manipulation hover:bg-canvas"
                title="Sumar 1 fabricada"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>

      {stockError && <p className="text-xs text-danger">{stockError}</p>}

      {/* Caja de precios, costo y ganancia */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-raised/50 p-2.5 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
            Venta directa
          </span>
          <span className="text-sm font-bold text-ink tabular-nums block mt-0.5">
            {formatMoney(product.salePrice, currency)}
          </span>
          {pieceCost !== null ? (
            <span className="text-[11px] text-ok font-semibold block mt-0.5">
              +{formatMoney(product.salePrice - pieceCost, currency)} margen
            </span>
          ) : (
            <span className="text-[11px] text-muted block mt-0.5">Sin costo calculado</span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
            Mercado Libre
          </span>
          {product.mlPrice !== null ? (
            <>
              <span className="text-sm font-bold text-ink tabular-nums block mt-0.5">
                {formatMoney(product.mlPrice, currency)}
              </span>
              {mlNet !== null && (
                <span className="text-[11px] text-muted block mt-0.5">
                  Neto: {formatMoney(mlNet, currency)}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted block mt-0.5">— No publicado</span>
          )}
        </div>
      </div>

      {/* Barra de acciones para móvil */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-line/40">
        <Link
          href={`/products/${product.id}`}
          className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
        >
          Ficha y stock
        </Link>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex min-h-9 px-3 items-center justify-center rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={togglePending}
          onClick={handleToggleActive}
          className="inline-flex min-h-9 px-3 items-center justify-center rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
        >
          {product.active ? "Desactivar" : "Reactivar"}
        </button>
        {canBeDeleted ? (
          <button
            type="button"
            disabled={deletePending}
            onClick={handleDelete}
            className="inline-flex min-h-9 px-3 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft text-xs font-semibold text-danger hover:bg-danger/20 touch-manipulation"
            title="Eliminar definitivamente"
          >
            {deletePending ? "…" : "Eliminar"}
          </button>
        ) : null}
      </div>
      {deleteState.error ? (
        <p className="text-xs text-danger">{deleteState.error}</p>
      ) : null}
    </div>
  );
}

/** Fila de tabla para pantallas grandes (>= 768px) */
function ProductRowItem({
  product,
  currency,
  costSummary,
}: {
  product: ProductListItem;
  currency: string;
  costSummary?: CatalogSettingsSummary;
}) {
  const {
    isEditing,
    setIsEditing,
    editName,
    setEditName,
    editSalePrice,
    setEditSalePrice,
    editMlPrice,
    setEditMlPrice,
    editCategory,
    setEditCategory,
    editMaterial,
    setEditMaterial,
    editGrams,
    setEditGrams,
    editMinutes,
    setEditMinutes,
    editColors,
    setEditColors,
    editPurge,
    setEditPurge,
    editMinStock,
    setEditMinStock,
    updateState,
    updatePending,
    togglePending,
    deleteState,
    deletePending,
    stockPending,
    stockError,
    pieceCost,
    mlNet,
    canBeDeleted,
    handleQuickStock,
    handleUpdate,
    handleToggleActive,
    handleDelete,
  } = useProductItemLogic(product, costSummary);

  if (isEditing) {
    return (
      <tr className="border-b border-line/60 bg-surface/50">
        <td colSpan={5} className="p-3">
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <Field label="Nombre">
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Categoría">
                <input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={`Precio normal (${currency})`}>
                <input
                  required
                  type="number"
                  min="0"
                  value={editSalePrice}
                  onChange={(e) => setEditSalePrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Precio ML">
                <input
                  type="number"
                  min="0"
                  value={editMlPrice}
                  onChange={(e) => setEditMlPrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <Field label="Material">
                <select
                  value={editMaterial}
                  onChange={(e) => setEditMaterial(e.target.value)}
                  className={inputClass}
                >
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {MATERIAL_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Gramos">
                <input
                  type="number"
                  min="0"
                  value={editGrams}
                  onChange={(e) => setEditGrams(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Minutos">
                <input
                  type="number"
                  min="0"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Colores">
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={editColors}
                  onChange={(e) => setEditColors(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Purga (g)">
                <input
                  type="number"
                  min="0"
                  value={editPurge}
                  onChange={(e) => setEditPurge(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Stock mín.">
                <input
                  type="number"
                  min="0"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={updatePending}
                className={primaryBtn}
              >
                {updatePending ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={secondaryBtn}
              >
                Cancelar
              </button>
            </div>
            {updateState.error ? (
              <p className="w-full text-xs text-danger">{updateState.error}</p>
            ) : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-b border-line/50 transition-colors hover:bg-raised/40 ${
        !product.active ? "opacity-60" : ""
      }`}
    >
      <td className="p-3 text-sm font-medium text-ink">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/products/${product.id}`}
            className="font-semibold hover:text-primary hover:underline"
          >
            {product.name}
          </Link>
          {product.category && <Badge tone="neutral">{product.category}</Badge>}
          {!product.active ? <Badge tone="warn">Inactiva</Badge> : null}
          {product.isLowStock ? <Badge tone="warn">Stock bajo</Badge> : null}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {product.material}
          {product.grams > 0 ? ` · ${product.grams} g` : ""}
          {product.colorsCount > 1
            ? ` (${product.colorsCount} col + ${product.purgeGrams} g purga)`
            : ""}
          {product.printMinutes > 0 ? ` · ${product.printMinutes} min` : ""}
        </div>
      </td>
      <td className="p-3 text-sm">
        <div className="font-semibold text-ink">
          {formatMoney(product.salePrice, currency)}
        </div>
        {pieceCost !== null && (
          <div className="text-xs text-muted">
            Costo: {formatMoney(pieceCost, currency)} · Margen:{" "}
            <span className="font-semibold text-ok">
              +{formatMoney(product.salePrice - pieceCost, currency)}
            </span>
          </div>
        )}
      </td>
      <td className="p-3 text-sm">
        {product.mlPrice !== null ? (
          <div>
            <div className="font-medium text-ink">
              {formatMoney(product.mlPrice, currency)}
            </div>
            {mlNet !== null && (
              <div className="text-xs text-muted">
                Neto ML: {formatMoney(mlNet, currency)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold tabular-nums text-ink">
            {product.currentStock}
          </span>
          {product.active && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={stockPending || product.currentStock <= 0}
                onClick={() => handleQuickStock("EXIT")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-raised text-xs font-bold hover:bg-canvas disabled:opacity-40"
                title="Restar 1 del stock"
              >
                -
              </button>
              <button
                type="button"
                disabled={stockPending}
                onClick={() => handleQuickStock("ENTRY")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-raised text-xs font-bold hover:bg-canvas disabled:opacity-40"
                title="Sumar 1 fabricada al stock"
              >
                +
              </button>
            </div>
          )}
        </div>
        {stockError && (
          <p className="text-[11px] text-danger mt-0.5">{stockError}</p>
        )}
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <Link href={`/products/${product.id}`} className={secondaryBtn}>
            Stock / Ficha
          </Link>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={secondaryBtn}
          >
            Editar
          </button>
          <button
            type="button"
            disabled={togglePending}
            onClick={handleToggleActive}
            className={secondaryBtn}
          >
            {product.active ? "Desactivar" : "Reactivar"}
          </button>
          {canBeDeleted ? (
            <button
              type="button"
              disabled={deletePending}
              onClick={handleDelete}
              className={dangerBtn}
              title="Eliminar definitivamente (nunca ha sido usada en pedidos ni movimientos reales)"
            >
              {deletePending ? "…" : "Eliminar"}
            </button>
          ) : (
            <span
              className="px-2 text-[11px] text-faint cursor-help"
              title="No se puede eliminar porque tiene pedidos o movimientos reales de stock. Puedes desactivarla para ocultarla."
            >
              Histórica
            </span>
          )}
        </div>
        {deleteState.error ? (
          <p className="mt-1 text-right text-xs text-danger">
            {deleteState.error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function ProductList({
  products,
  currency,
  costSummary,
}: {
  products: ProductListItem[];
  currency: string;
  costSummary?: CatalogSettingsSummary;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    if (filter === "active" && !p.active) return false;
    if (filter === "inactive" && p.active) return false;
    if (
      search.trim() &&
      !p.name.toLowerCase().includes(search.toLowerCase().trim())
    )
      return false;
    return true;
  });

  return (
    <Card className="mt-6 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "active"
                ? "bg-primary text-white"
                : "bg-raised text-muted hover:text-ink"
            }`}
          >
            Activas ({products.filter((p) => p.active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "inactive"
                ? "bg-primary text-white"
                : "bg-raised text-muted hover:text-ink"
            }`}
          >
            Inactivas ({products.filter((p) => !p.active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-primary text-white"
                : "bg-raised text-muted hover:text-ink"
            }`}
          >
            Todas ({products.length})
          </button>
        </div>

        <input
          type="search"
          placeholder="Buscar pieza…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} sm:max-w-xs`}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line-strong p-6 text-center">
          <p className="text-sm font-medium text-ink">
            {search
              ? "Ninguna pieza tiene ese nombre."
              : products.length === 0
                ? "Aquí guardas las piezas que vendes seguido"
                : "No hay piezas en esta vista."}
          </p>
          {!search && products.length === 0 && (
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Con su precio y su stock, después las eliges en una venta con un
              toque. También puedes guardarlas desde el cotizador.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {/* Vista móvil: tarjetas táctiles verticales sin desborde horizontal (md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filtered.map((item) => (
              <ProductCardItem
                key={item.id}
                product={item}
                currency={currency}
                costSummary={costSummary}
              />
            ))}
          </div>

          {/* Vista escritorio: tabla completa para pantallas anchas (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[680px] text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="p-3">Pieza y fabricación</th>
                  <th className="p-3">Precio directo y costo</th>
                  <th className="p-3">Precio Mercado Libre</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <ProductRowItem
                    key={item.id}
                    product={item}
                    currency={currency}
                    costSummary={costSummary}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
