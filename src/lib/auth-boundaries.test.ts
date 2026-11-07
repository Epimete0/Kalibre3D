// Fronteras de autorización (portado de Kurova, solo lectura, y recortado al núcleo de saas3d).
// Las reglas recorren src/ para que apliquen también a los módulos que se agreguen después.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" ? [] : listFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : [];
  }));
  return files.flat();
}

/** Servicios del núcleo: toda función exportada abre con un contexto de sesión o autorización (o lo recibe inyectado en pruebas). */
const coreServices = [
  "src/lib/account-service.ts",
  "src/lib/center-service.ts",
  "src/lib/center-settings-service.ts",
  "src/lib/customer-service.ts",
  "src/lib/invitation-admin-service.ts",
  "src/lib/member-service.ts",
  "src/lib/order-service.ts",
  "src/lib/product-service.ts",
];

describe("fronteras de autorización del núcleo", () => {
  it("solo el inicio y el perfil toleran una sesión sin taller (getSessionMembershipState)", async () => {
    const allowed = new Set(["src/lib/auth.ts", "src/app/(private)/dashboard/page.tsx", "src/app/(private)/profile/page.tsx"]);
    for (const file of [...await listFiles("src/app"), ...await listFiles("src/lib")]) {
      if (allowed.has(file)) continue;
      expect(await read(file), file).not.toContain("getSessionMembershipState");
    }
  });

  it("las Server Actions no importan Prisma: delegan en servicios", async () => {
    const actions = (await listFiles("src/app")).filter((file) => /\/actions\.ts$/.test(file));
    for (const file of actions) {
      const source = await read(file);
      expect(source, file).not.toContain("@/lib/prisma");
      expect(source, file).not.toContain("@/generated/prisma");
    }
  });

  it("cada función exportada de los servicios del núcleo pide su contexto antes de tocar datos", async () => {
    for (const file of coreServices) {
      const source = await read(file);
      const functions = [...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\r?\n\}\r?\n/g)];
      expect(functions.length, file).toBeGreaterThan(0);
      for (const [, name, body] of functions) {
        if (name === "createCenterForUser") continue; // Recibe el userId de quien ya validó la sesión (createCenter).
        expect(body.slice(0, 400), `${file} → ${name}`).toMatch(/require(?:Session(?:User)?|Auth|Catalog|Operational)(?:Context)?\(|deps\?\.auth/);
      }
    }
  });

  it("crear un taller exige sesión (no membresía), fija el rol OWNER en el servidor y limita a uno por persona", async () => {
    const service = await read("src/lib/center-creation.ts");
    expect(service).toContain("requireSessionUser()");
    expect(service).not.toContain("requireOperationalContext");
    expect(service).toContain('role: "OWNER"');
    expect(service).toContain("pg_advisory_xact_lock");
    const rules = await read("src/lib/center-creation-rules.ts");
    expect(rules).toContain("MAX_OWNED_CENTERS = 1");
    expect(rules).not.toContain("role");
  });

  it("el cambio de correo falla cerrado si no hay confirmación por correo", async () => {
    const service = await read("src/lib/email-change.ts");
    expect(service).toContain("autoconfirm !== false");
    expect(service).not.toMatch(/admin\.|service_role|SERVICE_ROLE/);
  });

  it("la aplicación no usa la llave secreta ni el service role de Supabase", async () => {
    for (const file of [...await listFiles("src"), "src/proxy.ts"]) {
      expect(await read(file), file).not.toMatch(/SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|service_role/);
    }
  });
});
