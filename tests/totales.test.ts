import { describe, expect, it } from "vitest";
import { calcularTotales, entregados } from "@/calculo/totales";

describe("entregados", () => {
  it("salida − vuelta", () => {
    expect(entregados({ salida: 120, vuelta: 8 })).toBe(112);
    expect(entregados({ salida: 50, vuelta: 50 })).toBe(0);
  });
  it("null si falta un dato o la vuelta supera la salida", () => {
    expect(entregados({ salida: null, vuelta: 8 })).toBeNull();
    expect(entregados({ salida: 120, vuelta: null })).toBeNull();
    expect(entregados({ salida: 10, vuelta: 20 })).toBeNull();
  });
});

describe("calcularTotales", () => {
  it("suma días, salida, vuelta y entregados", () => {
    const t = calcularTotales([
      { salida: 120, vuelta: 8 },
      { salida: 130, vuelta: 12 },
      { salida: 95, vuelta: 3 },
    ]);
    expect(t).toEqual({ diasTrabajados: 3, totalSalida: 345, totalVuelta: 23, totalEntregados: 322, diasExcluidos: 0 });
  });

  it("excluye del total los días incompletos o con error, pero los cuenta aparte", () => {
    const t = calcularTotales([
      { salida: 100, vuelta: 10 },
      { salida: 100, vuelta: null },
      { salida: 10, vuelta: 50 },
      { salida: null, vuelta: null },
    ]);
    expect(t).toMatchObject({ diasTrabajados: 1, totalEntregados: 90, diasExcluidos: 2 });
  });

  it("sin datos → todo a cero", () => {
    expect(calcularTotales([])).toEqual({ diasTrabajados: 0, totalSalida: 0, totalVuelta: 0, totalEntregados: 0, diasExcluidos: 0 });
  });
});
