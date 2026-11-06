import { Temporal } from "@js-temporal/polyfill";

const invalidTimeZoneMessage = "La zona horaria del taller no es válida.";
const invalidDateTimeMessage = "La fecha y hora de la atención no son válidas.";
const nonexistentTimeMessage = "La hora seleccionada no existe en la zona horaria del taller. Elige otra hora.";
const ambiguousTimeMessage = "La hora seleccionada es ambigua por un cambio de horario. Elige otra hora.";

type CenterLocalDateTime = {
  date: string;
  time: string;
  timeZone: string;
};

function parseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(invalidDateTimeMessage);
  try {
    return Temporal.PlainDate.from(date);
  } catch {
    throw new Error(invalidDateTimeMessage);
  }
}

function parseLocalDateTime(date: string, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(invalidDateTimeMessage);
  try {
    return Temporal.PlainDateTime.from(`${date}T${time}`);
  } catch {
    throw new Error(invalidDateTimeMessage);
  }
}

function hasSameLocalFields(left: Temporal.PlainDateTime, right: Temporal.PlainDateTime) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute;
}

function dayStart(date: Temporal.PlainDate, timeZone: string) {
  return date.toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from("00:00") }).toInstant();
}

export function validateIanaTimeZone(timeZone: string) {
  if (typeof timeZone !== "string" || !timeZone.trim() || /^(?:GMT|UTC)[+-]/i.test(timeZone) || /^Etc\/GMT/i.test(timeZone)) throw new Error(invalidTimeZoneMessage);
  try {
    return new Intl.DateTimeFormat("en", { timeZone: timeZone.trim() }).resolvedOptions().timeZone;
  } catch {
    throw new Error(invalidTimeZoneMessage);
  }
}

export function centerLocalDateTimeToUtc({ date, time, timeZone }: CenterLocalDateTime) {
  const validTimeZone = validateIanaTimeZone(timeZone);
  parseDate(date);
  const local = parseLocalDateTime(date, time);
  const earlier = local.toZonedDateTime(validTimeZone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(validTimeZone, { disambiguation: "later" });

  if (Temporal.Instant.compare(earlier.toInstant(), later.toInstant()) !== 0) {
    if (hasSameLocalFields(earlier.toPlainDateTime(), local)) throw new Error(ambiguousTimeMessage);
    throw new Error(nonexistentTimeMessage);
  }

  return new Date(earlier.epochMilliseconds);
}

export function formatInCenterTimeZone(instant: Date | Temporal.Instant, timeZone: string, options: Intl.DateTimeFormatOptions = {}) {
  const validTimeZone = validateIanaTimeZone(timeZone);
  const value = instant instanceof Date ? instant : new Date(instant.epochMilliseconds);
  return new Intl.DateTimeFormat("es-CL", { ...options, timeZone: validTimeZone }).format(value);
}

export function centerDayBoundsToUtc(date: string, timeZone: string) {
  const validTimeZone = validateIanaTimeZone(timeZone);
  const localDate = parseDate(date);
  return {
    start: new Date(dayStart(localDate, validTimeZone).epochMilliseconds),
    end: new Date(dayStart(localDate.add({ days: 1 }), validTimeZone).epochMilliseconds),
  };
}

export function centerDayPlusDays(date: string, timeZone: string, days: number) {
  validateIanaTimeZone(timeZone);
  return parseDate(date).add({ days }).toString();
}

export function centerNowFields(timeZone: string, now = new Date()) {
  const validTimeZone = validateIanaTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");
  if (!year || !month || !day || !hour || !minute) throw new Error(invalidDateTimeMessage);
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}
