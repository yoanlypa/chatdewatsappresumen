import type { Mensaje } from "../lector/tipos";
import { filtrarMensajes } from "../lector/personas";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function diaSemana(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

function mesSiguiente(anioMes: string): string {
  const [a, m] = anioMes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** Días del mes siguiente cuyos mensajes se envían también (pueden reportar los últimos días del mes). */
export const DIAS_MARGEN_MES_SIGUIENTE = 3;

// Mensajes que son solo un código (DNI/NIE, nº de seguimiento…): no aportan datos de reparto y son datos de terceros.
const SOLO_CODIGO = /^[A-Za-z]?\d{5,}[A-Za-z]?$/;

/**
 * Mensajes del repartidor que se envían a la IA: los del mes elegido, más los de los primeros días del mes
 * siguiente (un "Entreg 19 31/7" puede llegar el 1 o el 2). El código descarta después cualquier fecha fuera
 * del mes. Se omiten los mensajes que son solo un código.
 */
export function mensajesParaIA(mensajes: Mensaje[], remitente: string, anioMes: string): Mensaje[] {
  const delMes = filtrarMensajes(mensajes, remitente, anioMes);
  const siguiente = mesSiguiente(anioMes);
  const margen = filtrarMensajes(mensajes, remitente, siguiente).filter(
    (m) => Number(m.fechaHora.slice(8, 10)) <= DIAS_MARGEN_MES_SIGUIENTE,
  );
  return [...delMes, ...margen].filter((m) => !SOLO_CODIGO.test(m.texto.trim()));
}

/** Texto del mensaje de usuario: cada mensaje con su fecha, día de la semana y hora. */
export function formatearMensajes(mensajes: Mensaje[], anioMes: string): string {
  const lineas = mensajes.map((m, i) => {
    const fecha = m.fechaHora.slice(0, 10);
    const hora = m.fechaHora.slice(11, 16);
    const [primera, ...resto] = m.texto.split("\n");
    return [`#${i + 1} [${fecha} ${diaSemana(fecha)} ${hora}] ${primera}`, ...resto.map((l) => `    ${l}`)].join("\n");
  });
  return `Mes a procesar: ${anioMes}\n\nMensajes del repartidor:\n${lineas.join("\n")}`;
}
