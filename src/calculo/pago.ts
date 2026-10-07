/** Cálculo del pago a un repartidor. Siempre en código; la IA no interviene. */

export type TipoTarifa = "POR_PAQUETE" | "POR_DIA" | "FIJO_MAS_VARIABLE";

export interface Tarifa {
  tipo: TipoTarifa;
  /** €/paquete entregado (POR_PAQUETE y variable de FIJO_MAS_VARIABLE). */
  tarifaPaquete: number;
  /** €/día trabajado (POR_DIA). */
  tarifaDia: number;
  /** € fijos al mes (FIJO_MAS_VARIABLE). */
  tarifaFija: number;
}

export interface ResultadoPago {
  /** Importe según la tarifa, sin ajustes. */
  base: number;
  /** Suma de ajustes (positivos suman, negativos restan). */
  ajustes: number;
  total: number;
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularPago(
  totales: { diasTrabajados: number; totalEntregados: number },
  tarifa: Tarifa,
  ajustes: number[] = [],
): ResultadoPago {
  let base: number;
  switch (tarifa.tipo) {
    case "POR_PAQUETE":
      base = totales.totalEntregados * tarifa.tarifaPaquete;
      break;
    case "POR_DIA":
      base = totales.diasTrabajados * tarifa.tarifaDia;
      break;
    case "FIJO_MAS_VARIABLE":
      base = tarifa.tarifaFija + totales.totalEntregados * tarifa.tarifaPaquete;
      break;
  }
  const sumaAjustes = ajustes.reduce((s, a) => s + a, 0);
  return { base: redondear(base), ajustes: redondear(sumaAjustes), total: redondear(base + sumaAjustes) };
}

export const ETIQUETA_TARIFA: Record<TipoTarifa, string> = {
  POR_PAQUETE: "Por paquete entregado",
  POR_DIA: "Por día trabajado",
  FIJO_MAS_VARIABLE: "Fijo mensual + por paquete",
};

export function formatearEuros(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}
