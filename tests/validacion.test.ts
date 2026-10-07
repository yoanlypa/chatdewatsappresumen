import { describe, expect, it } from "vitest";
import type { RegistroIA } from "@/ia/esquema";
import { validarRegistros } from "@/validacion/validar";

const reg = (fecha: string, salida: number | null, vuelta: number | null, extra: Partial<RegistroIA> = {}): RegistroIA => ({
  fecha,
  salida,
  vuelta,
  confianza: "alta",
  nota: null,
  mensaje_original: `${salida}/${vuelta}`,
  ...extra,
});

const MES = "2026-09";
const validar = (rs: RegistroIA[], extra = {}) => validarRegistros(rs, { anioMes: MES, ...extra });

/** Siete días normales (~100 salida) para que haya "lo habitual". */
const normales = ["01", "02", "03", "04", "05", "07", "08"].map((d, i) => reg(`${MES}-${d}`, 100 + i, 5));

describe("validarRegistros · estado por día", () => {
  it("día correcto → ok", () => {
    const { registros } = validar([reg("2026-09-01", 120, 8)]);
    expect(registros[0]).toMatchObject({ estado: "ok", motivos: [] });
  });

  it("vuelta > salida → error", () => {
    const { registros } = validar([reg("2026-09-01", 10, 80)]);
    expect(registros[0].estado).toBe("error");
    expect(registros[0].motivos[0]).toMatch(/mayor que la salida/);
  });

  it.each([
    ["salida", null, 5],
    ["vuelta", 100, null],
  ])("falta %s → dudoso", (_n, salida, vuelta) => {
    const { registros } = validar([reg("2026-09-01", salida, vuelta)]);
    expect(registros[0].estado).toBe("dudoso");
  });

  it("confianza baja → dudoso", () => {
    const { registros } = validar([reg("2026-09-01", 100, 5, { confianza: "baja", nota: "ambiguo" })]);
    expect(registros[0]).toMatchObject({ estado: "dudoso", notaIa: "ambiguo" });
  });

  it("dos datos distintos el mismo día → un solo registro dudoso", () => {
    const { registros } = validar([reg("2026-09-01", 120, 8), reg("2026-09-01", 118, 8)]);
    expect(registros).toHaveLength(1);
    expect(registros[0].estado).toBe("dudoso");
    expect(registros[0].motivos.join()).toMatch(/Datos distintos/);
    expect(registros[0].mensajeOriginal).toBe("120/8\n118/8");
  });

  it("el mismo dato repetido el mismo día no es conflicto", () => {
    const { registros } = validar([reg("2026-09-01", 120, 8), reg("2026-09-01", 120, 8)]);
    expect(registros).toHaveLength(1);
    expect(registros[0].estado).toBe("ok");
  });

  it("ignora registros de fuera del mes y ordena por fecha", () => {
    const { registros } = validar([reg("2026-09-03", 100, 5), reg("2026-08-31", 100, 5), reg("2026-09-01", 100, 5)]);
    expect(registros.map((r) => r.fecha)).toEqual(["2026-09-01", "2026-09-03"]);
  });
});

describe("validarRegistros · cifras fuera de lo normal", () => {
  it("una salida disparada es dudosa y no contagia a los días normales", () => {
    const { registros } = validar([...normales, reg("2026-09-09", 1000, 5)]);
    const estados = Object.fromEntries(registros.map((r) => [r.fecha, r.estado]));
    expect(estados["2026-09-09"]).toBe("dudoso");
    expect(registros.filter((r) => r.estado !== "ok")).toHaveLength(1);
    expect(registros.find((r) => r.fecha === "2026-09-09")!.motivos.join()).toMatch(/Salida \(1000\)/);
  });

  it("con pocos días no hay referencia y no se marca nada", () => {
    const { registros } = validar([reg("2026-09-01", 100, 5), reg("2026-09-02", 100, 5), reg("2026-09-03", 900, 5)]);
    expect(registros.every((r) => r.estado === "ok")).toBe(true);
  });

  it("el umbral es configurable", () => {
    const rs = [...normales, reg("2026-09-09", 140, 5)];
    expect(validar(rs).registros.every((r) => r.estado === "ok")).toBe(true);
    expect(validar(rs, { umbralDesviacion: 0.2 }).registros.find((r) => r.fecha === "2026-09-09")!.estado).toBe("dudoso");
  });
});

describe("validarRegistros · días laborables sin datos", () => {
  it("avisa de lunes a sábado por defecto (septiembre 2026: 26 laborables)", () => {
    const { avisos } = validar([reg("2026-09-01", 100, 5)]);
    expect(avisos).toHaveLength(25);
    expect(avisos.map((a) => a.fecha)).not.toContain("2026-09-06"); // domingo
    expect(avisos.map((a) => a.fecha)).not.toContain("2026-09-01");
  });

  it("los días laborables son configurables", () => {
    const { avisos } = validar([], { diasLaborables: [1] }); // solo lunes: 7, 14, 21, 28
    expect(avisos.map((a) => a.fecha)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
  });
});
