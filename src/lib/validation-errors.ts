import type { z } from "zod";

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    result[key] = result[key] ? `${result[key]} · ${issue.message}` : issue.message;
  }
  return result;
}
