import { formatInCenterTimeZone } from "@/lib/center-time-zone";

export function LocalDateTime({ value, timeZone }: { value: Date | string; timeZone: string | null }) {
  const instant = new Date(value);
  const formatted = formatInCenterTimeZone(instant, timeZone ?? "UTC", { dateStyle: "medium", timeStyle: "short" });

  return <time dateTime={instant.toISOString()}>{formatted}</time>;
}
