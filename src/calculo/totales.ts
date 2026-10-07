/** Todo cálculo de entregados y totales lo hace el código, nunca la IA. */

export interface DatosDia {
  salida: number | null;
  vuelta: number | null;
}

/** entregados = salida − vuelta. null si falta algún dato o si vuelta > salida (error). */
export function entregados(d: DatosDia): number | null {
  if (d.salida == null || d.vuelta == null || d.vuelta > d.salida) return null;
  return d.salida - d.vuelta;
}

export interface Totales {
  /** Días con entregados calculable (salida y vuelta presentes y coherentes). */
  diasTrabajados: number;
  totalSalida: number;
  totalVuelta: number;
  totalEntregados: number;
  /** Días con algún dato pero sin entregados calculable (faltan datos o hay error). */
  diasExcluidos: number;
}

export function calcularTotales(dias: DatosDia[]): Totales {
  const t: Totales = { diasTrabajados: 0, totalSalida: 0, totalVuelta: 0, totalEntregados: 0, diasExcluidos: 0 };
  for (const d of dias) {
    const e = entregados(d);
    if (e === null) {
      if (d.salida != null || d.vuelta != null) t.diasExcluidos++;
      continue;
    }
    t.diasTrabajados++;
    t.totalSalida += d.salida!;
    t.totalVuelta += d.vuelta!;
    t.totalEntregados += e;
  }
  return t;
}
