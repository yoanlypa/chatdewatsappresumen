import type { Mensaje } from "./tipos";
import { normalizarNombre } from "./texto";
import { nombreDesdeArchivo } from "./archivo";

export function remitentesDe(mensajes: Mensaje[]): string[] {
  return [...new Set(mensajes.map((m) => m.remitente))];
}

export interface ResultadoDueno {
  remitente: string | null;
  /** Remitentes posibles; si `remitente` es null hay que pedir confirmación al usuario. */
  candidatos: string[];
  /** true si viene de los ajustes guardados o se dedujo sin ambigüedad. */
  seguro: boolean;
}

/**
 * El dueño es el remitente presente en todos los archivos subidos.
 * Si ya hay uno guardado en ajustes y aparece en los chats, se usa ese.
 */
export function detectarDueno(remitentesPorChat: string[][], guardado?: string | null): ResultadoDueno {
  const todos = [...new Set(remitentesPorChat.flat())];
  if (guardado) {
    const g = normalizarNombre(guardado);
    const hallado = todos.find((r) => normalizarNombre(r) === g);
    if (hallado) return { remitente: hallado, candidatos: [hallado], seguro: true };
  }
  if (remitentesPorChat.length === 0) return { remitente: null, candidatos: [], seguro: false };

  const comunes = todos.filter((r) =>
    remitentesPorChat.every((lista) => lista.some((x) => normalizarNombre(x) === normalizarNombre(r))),
  );
  // Con un solo chat, ambos remitentes serían "comunes": hay que confirmar.
  if (remitentesPorChat.length >= 2 && comunes.length === 1) {
    return { remitente: comunes[0], candidatos: comunes, seguro: true };
  }
  return { remitente: null, candidatos: comunes.length ? comunes : todos, seguro: false };
}

export interface RepartidorConocido {
  id: number;
  nombre: string;
  aliasWhatsapp: string[];
}

export interface RepartidorIdentificado {
  /** Remitente (tal como sale en el chat) que corresponde al repartidor, si se pudo determinar. */
  remitente: string | null;
  /** Nombre detectado: del archivo, o del remitente si el archivo no lo dice. */
  nombreDetectado: string | null;
  /** Repartidor ya dado de alta que coincide por nombre o alias; null si es nuevo. */
  repartidorId: number | null;
}

export function identificarRepartidor(args: {
  nombreArchivo: string;
  remitentes: string[];
  dueno: string | null;
  repartidores: RepartidorConocido[];
}): RepartidorIdentificado {
  const { nombreArchivo, remitentes, dueno, repartidores } = args;
  const nombreArchivoDetectado = nombreDesdeArchivo(nombreArchivo);
  const normArchivo = nombreArchivoDetectado ? normalizarNombre(nombreArchivoDetectado) : null;
  const normDueno = dueno ? normalizarNombre(dueno) : null;

  let candidatos = remitentes.filter((r) => normalizarNombre(r) !== normDueno);
  if (candidatos.length > 1 && normArchivo) {
    const porArchivo = candidatos.filter((r) => normalizarNombre(r) === normArchivo);
    if (porArchivo.length === 1) candidatos = porArchivo;
  }
  const remitente = candidatos.length === 1 ? candidatos[0] : null;

  const nombres = new Set<string>();
  if (normArchivo) nombres.add(normArchivo);
  if (remitente) nombres.add(normalizarNombre(remitente));

  const coincide = repartidores.find((r) =>
    [r.nombre, ...r.aliasWhatsapp].some((n) => nombres.has(normalizarNombre(n))),
  );

  return {
    remitente,
    nombreDetectado: nombreArchivoDetectado ?? remitente,
    repartidorId: coincide?.id ?? null,
  };
}

/** Mensajes de un remitente en un mes ("AAAA-MM"). */
export function filtrarMensajes(mensajes: Mensaje[], remitente: string, anioMes: string): Mensaje[] {
  const objetivo = normalizarNombre(remitente);
  return mensajes.filter(
    (m) => m.fechaHora.startsWith(anioMes) && normalizarNombre(m.remitente) === objetivo,
  );
}
