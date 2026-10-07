import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { identificarRepartidor, nombreDesdeArchivo, parsearChat, remitentesDe } from "@/lector";
import { mensajesParaIA } from "@/ia/preparar";
import type { RegistroIA } from "@/ia/esquema";
import { validarRegistros } from "@/validacion/validar";
import { calcularTotales } from "@/calculo/totales";

const fixture = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)), "utf8");

describe("chat iPhone con el estilo real de reporte", () => {
  const msgs = parsearChat(fixture("iphone_estilo_real.txt"));

  it("lee hora de 12 h con espacios especiales y quita marcas de edición y de imagen omitida", () => {
    const textos = msgs.map((m) => m.texto);
    expect(textos).toContain("49paq 30/6");
    expect(textos).toContain("Dejado en recepción");
    expect(textos).toContain("Y0321682h"); // el pie de la foto se conserva, sin la marca
    expect(textos.join("\n")).not.toMatch(/omitida|Se editó|cifrados/);
    expect(msgs.find((m) => m.texto === "49paq 30/6")!.fechaHora).toBe("2026-06-30T12:05:45");
    expect(msgs.find((m) => m.texto === "Dejado en recepción")!.fechaHora).toBe("2026-06-30T18:38:00");
  });

  it("mantiene los mensajes de varias líneas", () => {
    expect(msgs.some((m) => m.texto === "Salida 17\nEntregado 13 (09/07)")).toBe(true);
  });

  it("no envía a la IA los mensajes que son solo un código", () => {
    const paraIA = mensajesParaIA(msgs, "Yoanly Repartidor", "2026-07").map((m) => m.texto);
    expect(paraIA).not.toContain("Y0321682h");
    expect(paraIA).toContain("39 paq 1/7");
  });

  it("reconoce al repartidor aunque el archivo venga con guiones bajos y un número pegado", () => {
    expect(nombreDesdeArchivo("WhatsApp_Chat_-_Pedro_Hijo_De_Luisa2.zip")).toBe("Pedro Hijo De Luisa2");
    const r = identificarRepartidor({
      nombreArchivo: "WhatsApp_Chat_-_Yoanly_Repartidor2.zip",
      remitentes: remitentesDe(msgs),
      dueno: null,
      repartidores: [],
    });
    expect(r.remitente).toBe("Yoanly Repartidor");
  });
});

const ia = (fecha: string, extra: Partial<RegistroIA>): RegistroIA => ({
  fecha,
  salida: null,
  vuelta: null,
  entregados: null,
  confianza: "alta",
  nota: null,
  mensaje_original: "",
  ...extra,
});
const validar = (rs: RegistroIA[]) => validarRegistros(rs, { anioMes: "2026-07" });

describe("el código deduce la vuelta y une los mensajes del día", () => {
  it("salida por la mañana + entregados por la noche → vuelta = salida − entregados", () => {
    const { registros } = validar([
      ia("2026-07-01", { salida: 39, mensaje_original: "39 paq 1/7" }),
      ia("2026-07-01", { entregados: 34, mensaje_original: "34 entreg" }),
    ]);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ salida: 39, vuelta: 5, estado: "ok", mensajeOriginal: "39 paq 1/7\n34 entreg" });
    expect(registros[0].notaIa).toBeNull(); // la deducción no genera notas: solo importan los entregados
  });

  it("un solo registro con salida y entregados (\"11 de 13\")", () => {
    const { registros } = validar([ia("2026-07-03", { salida: 13, entregados: 11 })]);
    expect(registros[0]).toMatchObject({ salida: 13, vuelta: 2, estado: "ok" });
  });

  it("\"entreg todos\" → vuelta 0", () => {
    const { registros } = validar([ia("2026-07-03", { salida: 12, vuelta: 0 })]);
    expect(registros[0]).toMatchObject({ vuelta: 0, estado: "ok" });
  });

  it("entregados + vuelta sin salida → salida deducida", () => {
    const { registros } = validar([ia("2026-07-03", { entregados: 16, vuelta: 3 })]);
    expect(registros[0]).toMatchObject({ salida: 19, vuelta: 3, estado: "ok" });
  });

  it("solo entregados, sin salida → ok: lo único que importa son los entregados", () => {
    const { registros } = validar([ia("2026-07-02", { entregados: 27 })]);
    expect(registros[0]).toMatchObject({ entregados: 27, salida: null, estado: "ok" });
  });

  it("solo salida, sin entregados ni vuelta → dudoso", () => {
    const { registros } = validar([ia("2026-07-08", { salida: 9 })]);
    expect(registros[0]).toMatchObject({ entregados: null, estado: "dudoso" });
    expect(registros[0].motivos[0]).toMatch(/faltan los entregados/);
  });

  it("entregados mayores que la salida → error", () => {
    const { registros } = validar([ia("2026-07-02", { salida: 10, entregados: 15 })]);
    expect(registros[0].estado).toBe("error");
  });

  it("los tres datos que no cuadran → dudoso", () => {
    const { registros } = validar([ia("2026-07-02", { salida: 20, vuelta: 3, entregados: 15 })]);
    expect(registros[0].estado).toBe("dudoso");
    expect(registros[0].motivos.join()).toMatch(/No cuadra/);
  });

  it("dos cifras de salida distintas el mismo día siguen siendo conflicto", () => {
    const { registros } = validar([ia("2026-07-02", { salida: 20 }), ia("2026-07-02", { salida: 25, vuelta: 1 })]);
    expect(registros[0].estado).toBe("dudoso");
    expect(registros[0].motivos.join()).toMatch(/Datos distintos/);
  });

  it("totales con datos deducidos", () => {
    const { registros } = validar([
      ia("2026-07-01", { salida: 39, entregados: 34 }),
      ia("2026-07-03", { salida: 19, entregados: 16 }),
    ]);
    expect(calcularTotales(registros)).toMatchObject({ diasTrabajados: 2, totalEntregados: 50, totalVuelta: 8 });
  });
});

describe("identificarRepartidor: el nombre real del remitente manda sobre el del archivo", () => {
  const juan = remitentesDe(parsearChat(fixture("android_juan.txt")));

  it("si el archivo lleva el nombre de la otra persona, no se confunde con ella", () => {
    const r = identificarRepartidor({
      nombreArchivo: "WhatsApp_Chat_-_Carlos_Jefe2.zip", // exportado desde el móvil del repartidor
      remitentes: juan,
      dueno: "Carlos Jefe",
      repartidores: [{ id: 1, nombre: "Carlos Jefe", aliasWhatsapp: [] }],
    });
    expect(r).toEqual({ remitente: "Juan Pérez", nombreDetectado: "Juan Pérez", repartidorId: null });
  });

  it("si el archivo coincide con el remitente, también empareja por él", () => {
    const r = identificarRepartidor({
      nombreArchivo: "Chat de WhatsApp con Juan.txt",
      remitentes: juan,
      dueno: "Carlos Jefe",
      repartidores: [{ id: 5, nombre: "Juan", aliasWhatsapp: [] }],
    });
    expect(r).toMatchObject({ remitente: "Juan Pérez", repartidorId: 5 });
  });
});
