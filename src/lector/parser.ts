import type { Mensaje, OpcionesParser } from "./tipos";
import { limpiarLinea } from "./texto";

const FECHA = String.raw`(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})`;
const HORA = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?([ap])\.?\s?m\.?)?`;

// Android: `07/10/26, 21:15 - Juan: texto`
const CABECERA_ANDROID = new RegExp(String.raw`^${FECHA},?\s+${HORA}\s+-\s+(.*)$`, "i");
// iPhone: `[07/10/26, 21:15:03] Juan: texto`
const CABECERA_IOS = new RegExp(String.raw`^\[${FECHA},?\s+${HORA}\]\s+(.*)$`, "i");

const MARCA_EDITADO =
  /\s*<(?:se editó este mensaje|mensaje editado|this message was edited)\.?>\s*$/i;

const IGNORABLES: RegExp[] = [
  /cifrados de extremo a extremo/i,
  /end-to-end encrypted/i,
  /^<?(multimedia|imagen|audio|v[ií]deo|sticker|gif|documento|contacto|tarjeta de contacto)\s+omitid[oa]s?>?$/i,
  /^<?(media|image|audio|video|sticker|gif|document)\s+omitted>?$/i,
  /^<(adjunto|attached):.*>$/i,
  /^se elimin[oó] este mensaje\.?$/i,
  /^eliminaste este mensaje\.?$/i,
  /^(this message was deleted|you deleted this message)\.?$/i,
  /^(llamada|videollamada)( de (voz|v[ií]deo))? (perdida|rechazada)/i,
];

function esIgnorable(texto: string): boolean {
  return IGNORABLES.some((re) => re.test(texto));
}

const pad = (n: number) => String(n).padStart(2, "0");

function aFechaHora(g: RegExpMatchArray, orden: "DMY" | "MDY"): string | null {
  const [a, b] = [Number(g[1]), Number(g[2])];
  const dia = orden === "DMY" ? a : b;
  const mes = orden === "DMY" ? b : a;
  let anio = Number(g[3]);
  if (g[3].length <= 2) anio += 2000;

  let hora = Number(g[4]);
  const min = Number(g[5]);
  const seg = g[6] ? Number(g[6]) : 0;
  const ampm = g[7]?.toLowerCase();
  if (ampm) {
    if (hora < 1 || hora > 12) return null;
    hora = (hora % 12) + (ampm === "p" ? 12 : 0);
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || min > 59 || seg > 59) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1) return null; // p. ej. 31/02
  return `${anio}-${pad(mes)}-${pad(dia)}T${pad(hora)}:${pad(min)}:${pad(seg)}`;
}

interface Pendiente {
  fechaHora: string;
  resto: string;
  lineas: string[];
}

function cerrar(p: Pendiente, salida: Mensaje[]): void {
  const completo = [p.resto, ...p.lineas].join("\n");
  const sep = completo.indexOf(": ");
  if (sep < 0) return; // sin remitente: mensaje de sistema
  const remitente = completo.slice(0, sep).trim();
  const texto = completo.slice(sep + 2).replace(MARCA_EDITADO, "").trim();
  if (!remitente || !texto || esIgnorable(texto)) return;
  salida.push({ fechaHora: p.fechaHora, remitente, texto });
}

/**
 * Convierte el texto de un chat exportado de WhatsApp (Android o iPhone) en mensajes.
 * Ignora mensajes de sistema, multimedia omitida, mensajes eliminados y marcas de edición.
 */
export function parsearChat(contenido: string, opciones: OpcionesParser = {}): Mensaje[] {
  const orden = opciones.orden ?? "DMY";
  const mensajes: Mensaje[] = [];
  let actual: Pendiente | null = null;

  for (const bruta of contenido.split("\n")) {
    const linea = limpiarLinea(bruta);
    const g = linea.match(CABECERA_ANDROID) ?? linea.match(CABECERA_IOS);
    const fechaHora = g ? aFechaHora(g, orden) : null;
    if (g && fechaHora) {
      if (actual) cerrar(actual, mensajes);
      actual = { fechaHora, resto: g[g.length - 1], lineas: [] };
    } else if (actual) {
      actual.lineas.push(linea);
    }
  }
  if (actual) cerrar(actual, mensajes);
  return mensajes;
}
