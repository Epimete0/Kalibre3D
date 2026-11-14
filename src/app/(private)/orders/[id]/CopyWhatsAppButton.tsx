"use client";

import { useState } from "react";
import { buildWhatsAppChatUrl } from "@/lib/whatsapp-quote";

type CopyWhatsAppButtonProps = {
  summaryText: string;
  customerPhone?: string | null;
  customerName?: string | null;
};

export function CopyWhatsAppButton({
  summaryText,
  customerPhone,
  customerName,
}: CopyWhatsAppButtonProps) {
  const [copied, setCopied] = useState(false);
  const waUrl = buildWhatsAppChatUrl(customerPhone, summaryText);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Portapapeles restringido por el navegador
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas touch-manipulation"
      >
        {copied ? "Resumen copiado" : "Copiar resumen para WhatsApp"}
      </button>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ok/35 bg-ok-soft px-3 py-1.5 text-xs font-semibold text-ok transition-colors hover:brightness-95 touch-manipulation"
        >
          Enviar por WhatsApp{customerName ? ` a ${customerName}` : ""}
        </a>
      )}
    </div>
  );
}
