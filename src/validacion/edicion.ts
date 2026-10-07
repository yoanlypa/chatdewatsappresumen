import type { EstadoRegistro } from "./validar";

export interface DatosEditables {
  salida: number | null;
  vuelta: number | null;
  entregados: number | null;
}

export type CampoEditado = keyof DatosEditables;

export interface ResultadoEdicion extends DatosEditables {
  estado: EstadoRegistro;
  motivos: string[];
}

/**
 * Recalcula un día después de una edición manual.
 * - Si se edita salida o vuelta y están las dos, los entregados se recalculan (salida − vuelta).
 * - Si se editan los entregados, se respetan tal cual.
 * - El estado sale de las mismas reglas que en la importación, salvo que una edición manual
 *   resuelve la duda: queda "ok" si hay entregados coherentes.
 */
export function recalcularEdicion(datos: DatosEditables, campo: CampoEditado): ResultadoEdicion {
  const { salida, vuelta } = datos;
  let entregados = datos.entregados;

  if (campo !== "entregados" && salida != null && vuelta != null) {
    entregados = vuelta > salida ? null : salida - vuelta;
  }

  const motivos: string[] = [];
  let estado: EstadoRegistro = "ok";
  if (salida != null && vuelta != null && vuelta > salida) {
    estado = "error";
    motivos.push(`La vuelta (${vuelta}) es mayor que la salida (${salida})`);
  } else if (salida != null && entregados != null && entregados > salida) {
    estado = "error";
    motivos.push(`Los entregados (${entregados}) son más que la salida (${salida})`);
  } else if (entregados == null) {
    estado = "dudoso";
    motivos.push("Faltan los entregados");
  }
  return { salida, vuelta, entregados, estado, motivos };
}
