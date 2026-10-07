import type { RegistroIA } from "../ia/esquema";
import { entregados } from "../calculo/totales";

export type EstadoRegistro = "ok" | "dudoso" | "error";

export interface RegistroValidado {
  fecha: string;
  salida: number | null;
  vuelta: number | null;
  estado: EstadoRegistro;
  /** Por qué no está "ok" (para mostrarlo en la revisión). */
  motivos: string[];
  notaIa: string | null;
  mensajeOriginal: string;
}

export interface Aviso {
  fecha: string;
  tipo: "sin_datos";
  mensaje: string;
}

export interface OpcionesValidacion {
  /** Mes "AAAA-MM" que se valida. */
  anioMes: string;
  /** 0 = domingo … 6 = sábado. Por defecto lunes a sábado. */
  diasLaborables?: number[];
  /** Una cifra es atípica si supera lo habitual (mediana) por este factor, o es menos de 1/factor de ello. */
  factorAtipico?: number;
  /** Mínimo de otros días válidos necesarios para calcular lo habitual. */
  minimoDiasMedia?: number;
}

export const DIAS_LABORABLES_POR_DEFECTO = [1, 2, 3, 4, 5, 6];
export const FACTOR_ATIPICO_POR_DEFECTO = 3;
export const MINIMO_DIAS_MEDIA_POR_DEFECTO = 4;

const unicos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x?.trim()))];

interface Borrador extends RegistroValidado {
  baja: boolean;
  /** Entregados mayores que la salida: incoherente. */
  incoherente: boolean;
}

type Campo = "salida" | "vuelta" | "entregados";

/** Valor de un campo entre los registros de un día: los null se completan entre sí; si hay dos cifras distintas, conflicto. */
function valorDelDia(registros: RegistroIA[], campo: Campo): { valor: number | null; conflicto: boolean } {
  const valores = registros.map((r) => r[campo]).filter((v): v is number => v != null);
  const distintos = new Set(valores);
  return { valor: valores.at(-1) ?? null, conflicto: distintos.size > 1 };
}

function consolidarDia(fecha: string, registros: RegistroIA[]): Borrador {
  const motivos: string[] = [];
  const notas = unicos(registros.map((r) => r.nota));
  let baja = registros.some((r) => r.confianza === "baja");
  let incoherente = false;

  const s = valorDelDia(registros, "salida");
  const v = valorDelDia(registros, "vuelta");
  const e = valorDelDia(registros, "entregados");
  let salida = s.valor;
  let vuelta = v.valor;

  if (s.conflicto || v.conflicto || e.conflicto) {
    motivos.push("Datos distintos el mismo día sin resolver");
    baja = true;
  }

  // El código hace las cuentas: la IA solo copia lo que dice el repartidor.
  if (vuelta == null && e.valor != null && salida != null) {
    if (e.valor > salida) {
      incoherente = true;
      motivos.push(`Los entregados (${e.valor}) son más que la salida (${salida})`);
    } else {
      vuelta = salida - e.valor;
      notas.push(`Vuelta ${vuelta} deducida de ${e.valor} entregados`);
    }
  } else if (salida == null && e.valor != null && vuelta != null) {
    salida = e.valor + vuelta;
    notas.push(`Salida ${salida} deducida de ${e.valor} entregados + ${vuelta} de vuelta`);
  } else if (salida != null && vuelta != null && e.valor != null && salida - vuelta !== e.valor) {
    baja = true;
    motivos.push(`No cuadra: salida ${salida} − vuelta ${vuelta} ≠ ${e.valor} entregados`);
  }

  return {
    fecha,
    salida,
    vuelta,
    estado: "ok",
    motivos,
    notaIa: notas.join(" · ") || null,
    mensajeOriginal: unicos(registros.map((r) => r.mensaje_original)).join("\n"),
    baja,
    incoherente,
  };
}

function diasDelMes(anioMes: string): { fecha: string; diaSemana: number }[] {
  const [a, m] = anioMes.split("-").map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => ({
    fecha: `${anioMes}-${String(i + 1).padStart(2, "0")}`,
    diaSemana: new Date(Date.UTC(a, m - 1, i + 1)).getUTCDay(),
  }));
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const mitad = Math.floor(o.length / 2);
  return o.length % 2 ? o[mitad] : (o[mitad - 1] + o[mitad]) / 2;
}

/** Aplica las reglas de la sección 6 del SPEC. Función pura: no toca IA ni base de datos. */
export function validarRegistros(
  registrosIA: RegistroIA[],
  opciones: OpcionesValidacion,
): { registros: RegistroValidado[]; avisos: Aviso[] } {
  const factor = opciones.factorAtipico ?? FACTOR_ATIPICO_POR_DEFECTO;
  const minimo = opciones.minimoDiasMedia ?? MINIMO_DIAS_MEDIA_POR_DEFECTO;
  const laborables = opciones.diasLaborables ?? DIAS_LABORABLES_POR_DEFECTO;

  const porFecha = new Map<string, RegistroIA[]>();
  for (const r of registrosIA) {
    if (!r.fecha.startsWith(opciones.anioMes)) continue;
    porFecha.set(r.fecha, [...(porFecha.get(r.fecha) ?? []), r]);
  }
  const borradores = [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, rs]) => consolidarDia(fecha, rs));

  // Reglas por registro.
  for (const b of borradores) {
    if (b.incoherente) {
      b.estado = "error";
    } else if (b.salida != null && b.vuelta != null && b.vuelta > b.salida) {
      b.estado = "error";
      b.motivos.push(`La vuelta (${b.vuelta}) es mayor que la salida (${b.salida})`);
    } else if (b.salida == null || b.vuelta == null) {
      b.estado = "dudoso";
      b.motivos.push(b.salida == null ? "Falta la salida" : "Falta la vuelta");
    }
    if (b.baja) {
      if (b.estado === "ok") b.estado = "dudoso";
      if (!b.motivos.length || !b.motivos.some((m) => m.startsWith("Datos distintos"))) {
        b.motivos.push("Confianza baja de la IA");
      }
    }
  }

  // Cifras muy fuera de lo normal respecto a lo habitual del repartidor (mediana de sus demás días válidos;
  // la mediana evita que un solo valor disparado haga dudosos a todos los demás).
  const validos = borradores.filter((b) => entregados(b) !== null);
  for (const b of validos) {
    const otros = validos.filter((o) => o !== b);
    if (otros.length < minimo) continue;
    const comprobar = (nombre: string, valor: number, resto: number[]) => {
      const m = mediana(resto);
      if (m > 0 && (valor > m * factor || valor < m / factor)) {
        if (b.estado === "ok") b.estado = "dudoso";
        b.motivos.push(`${nombre} (${valor}) muy distinta de lo habitual (${Math.round(m)})`);
      }
    };
    comprobar("Salida", b.salida!, otros.map((o) => o.salida!));
    comprobar("Entregados", entregados(b)!, otros.map((o) => entregados(o)!));
  }

  // Días laborables sin ningún dato → aviso.
  const avisos: Aviso[] = diasDelMes(opciones.anioMes)
    .filter((d) => laborables.includes(d.diaSemana) && !porFecha.has(d.fecha))
    .map((d) => ({ fecha: d.fecha, tipo: "sin_datos", mensaje: "Día laborable sin datos" }));

  const registros: RegistroValidado[] = borradores.map(({ baja: _baja, incoherente: _inc, ...r }) => r);
  return { registros, avisos };
}
