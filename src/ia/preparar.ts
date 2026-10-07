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

/**
 * Mensajes del repartidor que se envían a la IA: los del mes elegido, más los de
 * madrugada (00:00–05:59) del día 1 del mes siguiente, que pueden referirse al último
 * día del mes. El código descarta después cualquier fecha fuera del mes.
 */
export function mensajesParaIA(mensajes: Mensaje[], remitente: string, anioMes: string): Mensaje[] {
  const delMes = filtrarMensajes(mensajes, remitente, anioMes);
  const siguiente = mesSiguiente(anioMes);
  const margen = filtrarMensajes(mensajes, remitente, siguiente).filter(
    (m) => m.fechaHora.startsWith(`${siguiente}-01`) && m.fechaHora.slice(11, 13) < "06",
  );
  return [...delMes, ...margen];
}

/** Texto del mensaje de usuario: cada mensaje con su fecha, día de la semana y hora. */
export function formatearMensajes(mensajes: Mensaje[], anioMes: string): string {
  const lineas = mensajes.map((m) => {
    const fecha = m.fechaHora.slice(0, 10);
    const hora = m.fechaHora.slice(11, 16);
    const [primera, ...resto] = m.texto.split("\n");
    return [`[${fecha} ${diaSemana(fecha)} ${hora}] ${primera}`, ...resto.map((l) => `    ${l}`)].join("\n");
  });
  return `Mes a procesar: ${anioMes}\n\nMensajes del repartidor:\n${lineas.join("\n")}`;
}
