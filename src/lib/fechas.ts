/** Utilidades de fechas "naive" (AAAA-MM-DD) sin zonas horarias. */

export const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const esAnioMes = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** "2026-07" → "julio 2026" */
export function etiquetaMes(anioMes: string): string {
  const [a, m] = anioMes.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${a}`;
}

/** Primer día del mes siguiente, "AAAA-MM-01". */
export function inicioMesSiguiente(anioMes: string): string {
  const [a, m] = anioMes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
}

export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Todos los días del mes con su día de la semana. */
export function diasDelMes(anioMes: string): { fecha: string; diaSemana: number }[] {
  const [a, m] = anioMes.split("-").map(Number);
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const fecha = `${anioMes}-${String(i + 1).padStart(2, "0")}`;
    return { fecha, diaSemana: diaSemana(fecha) };
  });
}

/** "2026-07-09" → "jue 9" */
export function etiquetaDia(fecha: string): string {
  return `${DIAS_CORTOS[diaSemana(fecha)]} ${Number(fecha.slice(8, 10))}`;
}

/** Mes de hoy, "AAAA-MM". */
export function mesActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

/** Date UTC a medianoche para columnas @db.Date. */
export const aFechaBD = (fecha: string) => new Date(`${fecha}T00:00:00Z`);
export const deFechaBD = (d: Date) => d.toISOString().slice(0, 10);
