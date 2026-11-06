/**
 * Versión vigente de los Términos y de la Política de Privacidad. Al crear la cuenta se guarda con qué versión y cuándo la
 * persona los aceptó (en los datos de su cuenta de Supabase Auth: es un registro, nunca se usa para autorizar nada).
 * Si cambian de fondo, se actualiza esta fecha y se vuelve a pedir la aceptación.
 */
export const TERMS_VERSION = "2026-11-06";
export const TERMS_VERSION_LABEL = "6 de noviembre de 2026";

/** Correo de contacto para consultas legales y de privacidad. Se define en el entorno; sin él, el texto indica escribir desde la cuenta. */
export const LEGAL_CONTACT_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() || null;

/** Los textos son un borrador hasta que una persona con criterio legal los revise: mientras tanto se avisa en la propia página. */
export const LEGAL_REVIEWED = process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true";

export const ACCEPT_TERMS_ERROR = "Para crear tu cuenta debes aceptar los Términos y la Política de Privacidad.";

/** Una casilla marcada llega como «on»; cualquier otra cosa cuenta como no aceptada. */
export const hasAcceptedTerms = (value: FormDataEntryValue | null) => value === "on";
