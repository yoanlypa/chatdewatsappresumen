import { describe, expect, it } from "vitest";
import { calcularPago } from "@/calculo/pago";
import { calcularTotales } from "@/calculo/totales";

const tarifa = { tarifaPaquete: 0.5, tarifaDia: 40, tarifaFija: 300 };
const totales = { diasTrabajados: 20, totalEntregados: 313 };

describe("calcularPago", () => {
  it("por paquete entregado", () => {
    expect(calcularPago(totales, { tipo: "POR_PAQUETE", ...tarifa })).toEqual({ base: 156.5, ajustes: 0, total: 156.5 });
  });
  it("por día trabajado", () => {
    expect(calcularPago(totales, { tipo: "POR_DIA", ...tarifa }).total).toBe(800);
  });
  it("fijo mensual + variable por paquete", () => {
    expect(calcularPago(totales, { tipo: "FIJO_MAS_VARIABLE", ...tarifa }).total).toBe(456.5);
  });
  it("suma ajustes positivos y negativos", () => {
    const r = calcularPago(totales, { tipo: "POR_PAQUETE", ...tarifa }, [-50, 12.5, -0.25]);
    expect(r).toEqual({ base: 156.5, ajustes: -37.75, total: 118.75 });
  });
  it("redondea a céntimos sin errores de coma flotante", () => {
    expect(calcularPago({ diasTrabajados: 1, totalEntregados: 3 }, { tipo: "POR_PAQUETE", ...tarifa, tarifaPaquete: 0.1 }).total).toBe(0.3);
  });
  it("sin entregados, solo el fijo", () => {
    expect(calcularPago({ diasTrabajados: 0, totalEntregados: 0 }, { tipo: "FIJO_MAS_VARIABLE", ...tarifa }).total).toBe(300);
  });
});

describe("calcularTotales con entregados guardados", () => {
  it("usa el entregados guardado cuando falta salida o vuelta", () => {
    const t = calcularTotales([
      { salida: null, vuelta: null, entregados: 27 },
      { salida: 39, vuelta: 5, entregados: 34 },
      { salida: 20, vuelta: null, entregados: null },
    ]);
    expect(t).toMatchObject({ diasTrabajados: 2, totalEntregados: 61, diasExcluidos: 1 });
  });
  it("un error (vuelta > salida) no cuenta", () => {
    expect(calcularTotales([{ salida: 10, vuelta: 20, entregados: 5 }])).toMatchObject({ diasTrabajados: 0, diasExcluidos: 1 });
  });
});
