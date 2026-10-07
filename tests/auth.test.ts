import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import { PrismaClient } from "@/generated/prisma/client";
import { firmarSesion, leerSesion } from "@/lib/sesion";
import { LimiteIntentos, MAX_FALLOS, VENTANA_MS } from "@/lib/limite";
import { destinoSeguro } from "@/lib/destino";
import {
  cambiarContrasena,
  crearUsuario,
  ErrorUsuario,
  verificarCredenciales,
} from "@/lib/usuarios";

afterEach(() => vi.unstubAllEnvs());

describe("sesión firmada", () => {
  it("firma y lee los datos de la sesión", async () => {
    const token = await firmarSesion({ usuarioId: 7, empresaId: 3 });
    expect(await leerSesion(token)).toEqual({ usuarioId: 7, empresaId: 3 });
  });

  it("rechaza tokens vacíos, manipulados o basura", async () => {
    const token = await firmarSesion({ usuarioId: 7, empresaId: 3 });
    expect(await leerSesion(undefined)).toBeNull();
    expect(await leerSesion("")).toBeNull();
    expect(await leerSesion("no-es-un-token")).toBeNull();
    const [cabecera, , firma] = token.split(".");
    const carga = Buffer.from(JSON.stringify({ uid: 1, eid: 1, exp: 9999999999 })).toString("base64url");
    expect(await leerSesion(`${cabecera}.${carga}.${firma}`)).toBeNull(); // cambiar el usuario invalida la firma
  });

  it("rechaza un token firmado con otra clave", async () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    const ajeno = await firmarSesion({ usuarioId: 1, empresaId: 1 });
    vi.stubEnv("SESSION_SECRET", "y".repeat(40));
    expect(await leerSesion(ajeno)).toBeNull();
  });

  it("rechaza un token caducado", async () => {
    vi.stubEnv("SESSION_SECRET", "z".repeat(40));
    const caducado = await new SignJWT({ uid: 1, eid: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode("z".repeat(40)));
    expect(await leerSesion(caducado)).toBeNull();
  });

  it("en producción exige SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    await expect(firmarSesion({ usuarioId: 1, empresaId: 1 })).rejects.toThrow(/SESSION_SECRET/);
    vi.stubEnv("SESSION_SECRET", "corta");
    await expect(firmarSesion({ usuarioId: 1, empresaId: 1 })).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("límite de intentos de login", () => {
  it(`bloquea tras ${MAX_FALLOS} fallos y se libera pasada la ventana`, () => {
    let ahora = 1_000_000;
    const l = new LimiteIntentos(() => ahora);
    for (let i = 0; i < MAX_FALLOS - 1; i++) l.registrarFallo("a");
    expect(l.bloqueadoSegundos("a")).toBe(0);
    l.registrarFallo("a");
    expect(l.bloqueadoSegundos("a")).toBeGreaterThan(0);
    expect(l.bloqueadoSegundos("otra")).toBe(0);
    ahora += VENTANA_MS + 1;
    expect(l.bloqueadoSegundos("a")).toBe(0);
  });

  it("un login correcto limpia los fallos", () => {
    const l = new LimiteIntentos();
    for (let i = 0; i < MAX_FALLOS; i++) l.registrarFallo("a");
    l.limpiar("a");
    expect(l.bloqueadoSegundos("a")).toBe(0);
  });
});

describe("destinoSeguro", () => {
  it.each([
    ["/meses/2026-07", "/meses/2026-07"],
    ["/importar?mes=2026-07", "/importar?mes=2026-07"],
    ["https://malo.com", "/meses"],
    ["//malo.com", "/meses"],
    ["/\\malo.com", "/meses"],
    ["", "/meses"],
    [undefined, "/meses"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let hayBD = false;
try {
  await prisma.$queryRaw`select 1`;
  hayBD = true;
} catch {
  console.warn("Sin base de datos: se omiten los tests de usuarios.");
}

describe.skipIf(!hayBD)("usuarios (base de datos)", () => {
  const sufijo = Date.now();
  const email = `prueba-${sufijo}@ejemplo.com`;
  let empresaId = 0;

  beforeAll(async () => {
    // Si no hay ninguna empresa, crearUsuario crearía una; usamos la primera existente o una temporal.
    const e = await prisma.empresa.findFirst({ orderBy: { id: "asc" } });
    empresaId = e ? e.id : (await prisma.empresa.create({ data: { nombre: `__test__${sufijo}` } })).id;
  });
  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { contains: `-${sufijo}@` } } });
    await prisma.$disconnect();
  });

  it("crea un usuario con la contraseña cifrada y email en minúsculas", async () => {
    const u = await crearUsuario(prisma, { email: `  Prueba-${sufijo}@Ejemplo.com `, contrasena: "una-clave-larga-1", coste: 4 });
    expect(u).toMatchObject({ email, empresaId });
    expect(u.passwordHash).not.toContain("una-clave-larga-1");
    expect(u.passwordHash.startsWith("$2")).toBe(true); // bcrypt
  });

  it("valida email, longitud de contraseña y duplicados", async () => {
    await expect(crearUsuario(prisma, { email: "no-es-email", contrasena: "una-clave-larga-1" })).rejects.toThrow(/email no es válido/);
    await expect(crearUsuario(prisma, { email: `otro-${sufijo}@ejemplo.com`, contrasena: "corta" })).rejects.toThrow(/al menos 10/);
    await expect(crearUsuario(prisma, { email, contrasena: "una-clave-larga-1", coste: 4 })).rejects.toBeInstanceOf(ErrorUsuario);
  });

  it("verifica credenciales sin distinguir mayúsculas en el email", async () => {
    expect(await verificarCredenciales(prisma, email.toUpperCase(), "una-clave-larga-1")).toMatchObject({ email });
    expect(await verificarCredenciales(prisma, email, "otra-clave-larga-1")).toBeNull();
    expect(await verificarCredenciales(prisma, `nadie-${sufijo}@ejemplo.com`, "una-clave-larga-1")).toBeNull();
  });

  it("cambia la contraseña", async () => {
    await cambiarContrasena(prisma, email, "nueva-clave-larga-2", 4);
    expect(await verificarCredenciales(prisma, email, "una-clave-larga-1")).toBeNull();
    expect(await verificarCredenciales(prisma, email, "nueva-clave-larga-2")).not.toBeNull();
    await expect(cambiarContrasena(prisma, `nadie-${sufijo}@ejemplo.com`, "nueva-clave-larga-2")).rejects.toThrow(/No existe/);
  });
});
