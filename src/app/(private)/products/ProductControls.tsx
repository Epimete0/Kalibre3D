"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import type { ProductListItem } from "@/lib/product-queries";
import { createProductAction, deleteProductAction, setProductActiveAction, updateProductAction } from "./actions";

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const dangerBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:opacity-60";

type State = { error?: string; message?: string };

function Feedback({ state }: { state: State }) {
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

export function CreateProductBar({ currency }: { currency: string }) {
  const [state, run, pending] = useActionState(createProductAction, {});
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [mlPrice, setMlPrice] = useState("");
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
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.set("name", name);
    data.set("salePrice", salePrice);
    data.set("mlPrice", mlPrice);
    startTransition(() => run(data));
  };

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-base font-semibold text-ink">Agregar nueva pieza a la lista de precios</h2>
      <p className="mt-0.5 text-xs text-muted">
        Ingresa el nombre y precio habitual para seleccionarla rápidamente al registrar ventas.
      </p>

      <form className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-12" onSubmit={handleSubmit}>
        <div className="sm:col-span-5">
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

        <div className="sm:col-span-3">
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

        <div className="sm:col-span-3">
          <Field label="Precio ML (opcional)" htmlFor={mlPriceId} hint="Si vendes por Mercado Libre">
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

        <div className="sm:col-span-1">
          <button type="submit" disabled={pending || !name.trim() || !salePrice} className={`${primaryBtn} w-full`}>
            {pending ? "…" : "Agregar"}
          </button>
        </div>
      </form>

      <div className="mt-3">
        <Feedback state={state} />
      </div>
    </Card>
  );
}

function ProductRowItem({ product, currency }: { product: ProductListItem; currency: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editSalePrice, setEditSalePrice] = useState(String(product.salePrice));
  const [editMlPrice, setEditMlPrice] = useState(product.mlPrice !== null ? String(product.mlPrice) : "");

  const [updateState, runUpdate, updatePending] = useActionState(updateProductAction, {});
  const [, runToggle, togglePending] = useActionState(setProductActiveAction, {});
  const [deleteState, runDelete, deletePending] = useActionState(deleteProductAction, {});

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.set("id", product.id);
    data.set("name", editName);
    data.set("salePrice", editSalePrice);
    data.set("mlPrice", editMlPrice);
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
    if (!window.confirm(`¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    const data = new FormData();
    data.set("id", product.id);
    startTransition(() => runDelete(data));
  };

  if (isEditing) {
    return (
      <tr className="border-b border-line/60 bg-surface/50">
        <td colSpan={5} className="p-3">
          <form onSubmit={handleUpdate} className="flex flex-wrap items-center gap-3">
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={`${inputClass} min-w-[180px] flex-1`}
              placeholder="Nombre"
            />
            <input
              required
              type="number"
              min="0"
              value={editSalePrice}
              onChange={(e) => setEditSalePrice(e.target.value)}
              className={`${inputClass} w-28`}
              placeholder="Precio normal"
            />
            <input
              type="number"
              min="0"
              value={editMlPrice}
              onChange={(e) => setEditMlPrice(e.target.value)}
              className={`${inputClass} w-28`}
              placeholder="Precio ML"
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={updatePending} className={primaryBtn}>
                {updatePending ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className={secondaryBtn}>
                Cancelar
              </button>
            </div>
            {updateState.error ? <p className="w-full text-xs text-danger">{updateState.error}</p> : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-line/50 transition-colors hover:bg-raised/40 ${!product.active ? "opacity-60" : ""}`}>
      <td className="p-3 text-sm font-medium text-ink">
        <div className="flex items-center gap-2">
          <span>{product.name}</span>
          {!product.active ? <Badge tone="warn">Inactiva</Badge> : null}
          {product.hasOrders ? (
            <span title="Esta pieza tiene ventas históricas registradas" className="text-[11px] text-muted">
              (con ventas)
            </span>
          ) : null}
        </div>
      </td>
      <td className="p-3 text-sm font-semibold text-ink">{formatMoney(product.salePrice, currency)}</td>
      <td className="p-3 text-sm text-faint">
        {product.mlPrice !== null ? formatMoney(product.mlPrice, currency) : "—"}
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={() => setIsEditing(true)} className={secondaryBtn}>
            Editar
          </button>
          <button type="button" disabled={togglePending} onClick={handleToggleActive} className={secondaryBtn}>
            {product.active ? "Desactivar" : "Reactivar"}
          </button>
          {!product.hasOrders ? (
            <button
              type="button"
              disabled={deletePending}
              onClick={handleDelete}
              className={dangerBtn}
              title="Eliminar definitivamente (nunca ha sido usada en pedidos)"
            >
              {deletePending ? "…" : "Eliminar"}
            </button>
          ) : (
            <span
              className="px-2 text-[11px] text-faint cursor-help"
              title="No se puede eliminar porque tiene pedidos históricos registrados. Puedes desactivarla para ocultarla."
            >
              Histórica
            </span>
          )}
        </div>
        {deleteState.error ? <p className="mt-1 text-right text-xs text-danger">{deleteState.error}</p> : null}
      </td>
    </tr>
  );
}

export function ProductList({ products, currency }: { products: ProductListItem[]; currency: string }) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) => {
    if (filter === "active" && !p.active) return false;
    if (filter === "inactive" && p.active) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase().trim())) return false;
    return true;
  });

  return (
    <Card className="mt-6 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "active" ? "bg-primary text-white" : "bg-raised text-muted hover:text-ink"
            }`}
          >
            Activas ({products.filter((p) => p.active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "inactive" ? "bg-primary text-white" : "bg-raised text-muted hover:text-ink"
            }`}
          >
            Inactivas ({products.filter((p) => !p.active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "all" ? "bg-primary text-white" : "bg-raised text-muted hover:text-ink"
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
          className={`${inputClass} max-w-xs`}
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line text-xs font-semibold text-muted">
              <th className="p-3">Pieza</th>
              <th className="p-3">Precio normal</th>
              <th className="p-3">Precio Mercado Libre</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-faint">
                  {search ? "No se encontraron piezas con ese nombre." : "No hay piezas registradas en esta vista."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => <ProductRowItem key={item.id} product={item} currency={currency} />)
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
