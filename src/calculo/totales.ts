/** Todo cálculo de entregados y totales lo hace el código, nunca la IA. */

export interface DatosDia {
  salida: number | null;
  vuelta: number | null;
  /** Entregados guardados: lo que dijo el repartidor o el resultado de salida − vuelta. */
  entregados?: number | null;
}

/**
 * Entregados del día. Si ya hay un valor guardado, ese manda; si no, salida − vuelta.
 * null si no se puede saber o si hay un error (vuelta > salida, entregados > salida).
 */
export function entregados(d: DatosDia): number | null {
  if (d.salida != null && d.vuelta != null && d.vuelta > d.salida) return null;
  if (d.entregados != null) {
    return d.salida != null && d.entregados > d.salida ? null : d.entregados;
  }
  if (d.salida != null && d.vuelta != null) return d.salida - d.vuelta;
  return null;
}

export interface Totales {
  /** Días con entregados conocidos. */
  diasTrabajados: number;
  totalEntregados: number;
  /** Suma de salidas y vueltas de los días contados que las tienen (informativo). */
  totalSalida: number;
  totalVuelta: number;
  /** Días con algún dato pero sin entregados calculables (faltan datos o hay error). */
  diasExcluidos: number;
}

export function calcularTotales(dias: DatosDia[]): Totales {
  const t: Totales = { diasTrabajados: 0, totalEntregados: 0, totalSalida: 0, totalVuelta: 0, diasExcluidos: 0 };
  for (const d of dias) {
    const e = entregados(d);
    if (e === null) {
      if (d.salida != null || d.vuelta != null || d.entregados != null) t.diasExcluidos++;
      continue;
    }
    t.diasTrabajados++;
    t.totalEntregados += e;
    t.totalSalida += d.salida ?? 0;
    t.totalVuelta += d.vuelta ?? 0;
  }
  return t;
}
