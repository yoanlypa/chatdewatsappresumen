import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import type Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@/generated/prisma/client";
import { analizarArchivos, procesarArchivo, ErrorImportacion } from "@/lib/importar";
import { detalleRepartidorMes, listarMeses, resumenMes } from "@/lib/consultas";
import { actualizarRegistro, crearRegistroManual, marcarRevisado, ErrorEdicion } from "@/lib/registros";
import { NOMBRE_HERRAMIENTA } from "@/ia/esquema";
import type { ClienteIA } from "@/ia/extraer";

const bytes = (n: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url))));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let hayBD = false;
try {
  await prisma.$queryRaw`select 1`;
  hayBD = true;
} catch {
  console.warn("Sin base de datos: se omiten los tests de integración (docker compose up -d).");
}

const reg = (fecha: string, salida: number | null, vuelta: number | null, entregados: number | null = null) => ({
  fecha, salida, vuelta, entregados, confianza: "alta", nota: null, mensajes: [1],
});
/** Lo que devolvería una IA correcta para android_juan.txt en septiembre (993 entregados en 9 días). */
const REGISTROS_JUAN = [
  reg("2026-09-01", 120, 8), reg("2026-09-02", 130, 12), reg("2026-09-03", 95, 3), reg("2026-09-04", 118, 5),
  reg("2026-09-05", 120, 8), reg("2026-09-07", 100, 4), reg("2026-09-08", 140, 10), reg("2026-09-09", 110, 6),
  reg("2026-09-11", 125, 9),
];
const clienteCon = (registros: unknown[]): ClienteIA => ({
  messages: {
    create: vi.fn().mockResolvedValue({
      id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: "tool_use", id: "t", name: NOMBRE_HERRAMIENTA, input: { registros } }],
    } as unknown as Anthropic.Message),
  },
});

const NOMBRE_JUAN = "Chat de WhatsApp con Juan Pérez.txt";
const MES = "2026-09";

describe.skipIf(!hayBD)("importación, consultas y edición (base de datos)", () => {
  let empresaId = 0;
  let repartidorId = 0;

  beforeAll(async () => {
    empresaId = (await prisma.empresa.create({ data: { nombre: `__test__${Date.now()}` } })).id;
  });

  afterAll(async () => {
    if (empresaId) {
      await prisma.ajuste.deleteMany({ where: { empresaId } });
      await prisma.importacion.deleteMany({ where: { empresaId } });
      await prisma.repartidor.deleteMany({ where: { empresaId } }); // borra sus registros en cascada
      await prisma.mes.deleteMany({ where: { empresaId } });
      await prisma.empresa.delete({ where: { id: empresaId } });
    }
    await prisma.$disconnect();
  });

  it("analiza varios archivos: detecta al dueño y a cada repartidor", async () => {
    const a = await analizarArchivos(
      prisma, empresaId,
      [{ nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }, { nombre: "Chat de WhatsApp con Ana López.txt", datos: bytes("android_ana.txt") }],
      MES,
    );
    expect(a).toMatchObject({ dueno: "Carlos Jefe", duenoSeguro: true, duenoConfirmado: false, mesCerrado: false });
    expect(a.archivos.map((x) => x.remitenteRepartidor)).toEqual(["Juan Pérez", "Ana López"]);
    expect(a.archivos[0]).toMatchObject({ error: null, mensajesEnMes: 12, repartidorId: null, existentes: null });
    expect(a.archivos[1].mensajesEnMes).toBe(0); // los mensajes de Ana son de octubre
  });

  it("con un solo archivo pide confirmar quién es el dueño", async () => {
    const a = await analizarArchivos(prisma, empresaId, [{ nombre: "x.txt", datos: bytes("android_juan.txt") }], MES);
    expect(a.dueno).toBeNull();
    expect(a.candidatosDueno.sort()).toEqual(["Carlos Jefe", "Juan Pérez"]);
    expect(a.archivos[0].error).toMatch(/Confirma quién eres/);
    const b = await analizarArchivos(prisma, empresaId, [{ nombre: "x.txt", datos: bytes("android_juan.txt") }], MES, "Carlos Jefe");
    expect(b.archivos[0]).toMatchObject({ error: null, remitenteRepartidor: "Juan Pérez" });
  });

  it("procesa un archivo: crea el repartidor y guarda los días", async () => {
    const r = await procesarArchivo(prisma, empresaId, { nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }, {
      anioMes: MES, dueno: "Carlos Jefe", cliente: clienteCon(REGISTROS_JUAN),
    });
    repartidorId = r.repartidorId;
    expect(r).toMatchObject({ repartidor: "Juan Pérez", dias: 9, entregados: 993, dudosos: 0, errores: 0 });
    expect(await prisma.registroDia.count({ where: { repartidorId } })).toBe(9);
    const dia = await prisma.registroDia.findFirstOrThrow({ where: { repartidorId, fecha: new Date("2026-09-04T00:00:00Z") } });
    expect(dia).toMatchObject({ salida: 118, vuelta: 5, entregados: 113, estado: "ok", editadoManual: false });
    expect(dia.mensajeOriginal).toContain("120 y volví con 5".slice(0, 3)); // texto real del chat, no de la IA
    const imp = await prisma.importacion.findFirstOrThrow({ where: { empresaId, repartidorId } });
    expect(imp).toMatchObject({ estado: "PROCESADA", nombreArchivo: NOMBRE_JUAN });
  });

  it("reconoce al repartidor ya creado y avisa de lo que se pisaría", async () => {
    const a = await analizarArchivos(prisma, empresaId, [{ nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }], MES, "Carlos Jefe");
    expect(a.archivos[0]).toMatchObject({ repartidorId, existentes: { registros: 9, editados: 0, revisados: 0 } });
  });

  it("resumen del mes con el importe según la tarifa, y lista de meses", async () => {
    await prisma.repartidor.update({ where: { id: repartidorId }, data: { tipoTarifa: "POR_PAQUETE", tarifaPaquete: 0.5 } });
    const r = await resumenMes(prisma, empresaId, MES);
    expect(r.repartidores).toHaveLength(1);
    expect(r.repartidores[0]).toMatchObject({ nombre: "Juan Pérez", dias: 9, entregados: 993, dudosos: 0, revisado: false, sinDatos: 17 });
    expect(r.repartidores[0].pago).toEqual({ base: 496.5, ajustes: 0, total: 496.5 });
    expect((await listarMeses(prisma, empresaId))[0]).toMatchObject({ anioMes: MES, repartidores: 1, entregados: 993, cerrado: false });
  });

  it("detalle: incluye los laborables sin datos y deja fuera los domingos", async () => {
    const d = (await detalleRepartidorMes(prisma, empresaId, repartidorId, MES))!;
    const fechas = d.filas.map((f) => f.fecha);
    expect(fechas).toContain("2026-09-10"); // jueves sin datos
    expect(fechas).not.toContain("2026-09-06"); // domingo
    expect(d.filas.find((f) => f.fecha === "2026-09-10")!.registro).toBeNull();
    expect(d.filas.find((f) => f.fecha === "2026-09-01")!.registro).toMatchObject({ entregados: 112 });
    expect(await detalleRepartidorMes(prisma, empresaId + 99999, repartidorId, MES)).toBeNull(); // otra empresa
  });

  it("edición manual: recalcula entregados y marca el cambio", async () => {
    const dia = await prisma.registroDia.findFirstOrThrow({ where: { repartidorId, fecha: new Date("2026-09-01T00:00:00Z") } });
    const r = await actualizarRegistro(prisma, empresaId, { registroId: dia.id, campo: "vuelta", valor: 10 });
    expect(r).toMatchObject({ salida: 120, vuelta: 10, entregados: 110, estado: "ok", editadoManual: true });
    const e = await actualizarRegistro(prisma, empresaId, { registroId: dia.id, campo: "vuelta", valor: 500 });
    expect(e).toMatchObject({ estado: "error", entregados: null });
    await expect(actualizarRegistro(prisma, empresaId, { registroId: dia.id, campo: "salida", valor: -3 })).rejects.toBeInstanceOf(ErrorEdicion);
    await actualizarRegistro(prisma, empresaId, { registroId: dia.id, campo: "vuelta", valor: 8 });
    const resumen = await resumenMes(prisma, empresaId, MES);
    expect(resumen.repartidores[0].entregados).toBe(993);
  });

  it("no deja editar registros de otra empresa", async () => {
    const dia = await prisma.registroDia.findFirstOrThrow({ where: { repartidorId } });
    await expect(actualizarRegistro(prisma, empresaId + 99999, { registroId: dia.id, campo: "vuelta", valor: 1 })).rejects.toThrow(/no encontrado/);
  });

  it("crea el registro de un día vacío al escribir un valor, y cuenta en el total", async () => {
    const r = await crearRegistroManual(prisma, empresaId, { repartidorId, fecha: "2026-09-10", campo: "entregados", valor: 20 });
    expect(r).toMatchObject({ entregados: 20, salida: null, estado: "ok", editadoManual: true });
    expect((await resumenMes(prisma, empresaId, MES)).repartidores[0]).toMatchObject({ entregados: 1013, dias: 10, sinDatos: 16 });
  });

  it("marcar como revisado y volver a importar avisa de los cambios manuales", async () => {
    expect(await marcarRevisado(prisma, empresaId, repartidorId, MES, true)).toBe(10);
    expect((await resumenMes(prisma, empresaId, MES)).repartidores[0].revisado).toBe(true);
    const a = await analizarArchivos(prisma, empresaId, [{ nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }], MES, "Carlos Jefe");
    expect(a.archivos[0].existentes).toMatchObject({ registros: 10, editados: 2, revisados: 10 });
  });

  it("volver a importar reemplaza los días del repartidor en el mes", async () => {
    await procesarArchivo(prisma, empresaId, { nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }, {
      anioMes: MES, dueno: "Carlos Jefe", cliente: clienteCon(REGISTROS_JUAN.slice(0, 3)),
    });
    expect(await prisma.registroDia.count({ where: { repartidorId } })).toBe(3);
  });

  it("un mes cerrado no se puede importar ni editar", async () => {
    await prisma.mes.update({ where: { empresaId_anioMes: { empresaId, anioMes: MES } }, data: { estado: "CERRADO" } });
    await expect(
      procesarArchivo(prisma, empresaId, { nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }, { anioMes: MES, dueno: "Carlos Jefe", cliente: clienteCon([]) }),
    ).rejects.toBeInstanceOf(ErrorImportacion);
    const dia = await prisma.registroDia.findFirstOrThrow({ where: { repartidorId } });
    await expect(actualizarRegistro(prisma, empresaId, { registroId: dia.id, campo: "vuelta", valor: 1 })).rejects.toThrow(/cerrado/);
    await expect(marcarRevisado(prisma, empresaId, repartidorId, MES, false)).rejects.toThrow(/cerrado/);
    expect((await analizarArchivos(prisma, empresaId, [], MES)).mesCerrado).toBe(true);
    const err = await prisma.importacion.findFirst({ where: { empresaId, estado: "ERROR" } });
    expect(err?.error).toMatch(/cerrado/);
  });

  it("procesar varios archivos a la vez sobre un mes nuevo no choca al crear el mes", async () => {
    const entradas = [
      { nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") },
      { nombre: "Chat de WhatsApp con María Gómez.txt", datos: bytes("iphone_maria.txt") },
      { nombre: "Chat de WhatsApp con Ana López.txt", datos: bytes("android_ana.txt") },
    ];
    const resultados = await Promise.allSettled(
      entradas.map((e) => procesarArchivo(prisma, empresaId, e, { anioMes: "2026-11", dueno: "Carlos Jefe", cliente: clienteCon([]) })),
    );
    expect(resultados.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect(await prisma.mes.count({ where: { empresaId, anioMes: "2026-11" } })).toBe(1);
  });

  it("un fallo inesperado también queda anotado en la importación", async () => {
    const roto = new Proxy(prisma, {
      get: (obj, prop) => (prop === "repartidor" ? { findMany: () => Promise.reject(new Error("BD caída")) } : Reflect.get(obj, prop)),
    }) as PrismaClient;
    await expect(
      procesarArchivo(roto, empresaId, { nombre: "fallo.txt", datos: bytes("android_juan.txt") }, { anioMes: "2026-12", dueno: "Carlos Jefe", cliente: clienteCon([]) }),
    ).rejects.toThrow(/BD caída/);
    const imp = await prisma.importacion.findFirstOrThrow({ where: { empresaId, nombreArchivo: "fallo.txt" } });
    expect(imp).toMatchObject({ estado: "ERROR" });
    expect(imp.error).toMatch(/Error inesperado: BD caída/);
  });

  it("si la IA falla, queda registrado el error y no se tocan los datos", async () => {
    await prisma.mes.update({ where: { empresaId_anioMes: { empresaId, anioMes: MES } }, data: { estado: "ABIERTO" } });
    const malo: ClienteIA = { messages: { create: vi.fn().mockRejectedValue(new Error("sin crédito")) } };
    await expect(
      procesarArchivo(prisma, empresaId, { nombre: NOMBRE_JUAN, datos: bytes("android_juan.txt") }, { anioMes: MES, dueno: "Carlos Jefe", cliente: malo }),
    ).rejects.toThrow(/Falló la extracción con IA: sin crédito/);
    expect(await prisma.registroDia.count({ where: { repartidorId } })).toBe(3);
  });
});
