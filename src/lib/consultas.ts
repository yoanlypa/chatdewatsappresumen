import type { PrismaClient } from "../generated/prisma/client";
import { calcularTotales, entregados } from "../calculo/totales";
import { calcularPago, type ResultadoPago, type Tarifa } from "../calculo/pago";
import { aFechaBD, deFechaBD, diasDelMes, inicioMesSiguiente } from "./fechas";
import type { DetalleRepartidorMes, RegistroUI, TarifaUI } from "./tipos-ui";

type RepartidorDB = { tipoTarifa: Tarifa["tipo"]; tarifaPaquete: { toNumber(): number }; tarifaDia: { toNumber(): number }; tarifaFija: { toNumber(): number } };

export function tarifaDe(r: RepartidorDB): TarifaUI {
  return {
    tipo: r.tipoTarifa,
    tarifaPaquete: r.tarifaPaquete.toNumber(),
    tarifaDia: r.tarifaDia.toNumber(),
    tarifaFija: r.tarifaFija.toNumber(),
  };
}

const rangoMes = (anioMes: string) => ({ gte: aFechaBD(`${anioMes}-01`), lt: aFechaBD(inicioMesSiguiente(anioMes)) });

export interface MesResumen {
  anioMes: string;
  cerrado: boolean;
  repartidores: number;
  entregados: number;
  dudosos: number;
}

/** Meses con datos (o creados), el más reciente primero. */
export async function listarMeses(prisma: PrismaClient, empresaId: number): Promise<MesResumen[]> {
  const [registros, meses] = await Promise.all([
    prisma.registroDia.findMany({
      where: { empresaId },
      select: { fecha: true, repartidorId: true, salida: true, vuelta: true, entregados: true, estado: true },
    }),
    prisma.mes.findMany({ where: { empresaId } }),
  ]);
  const mapa = new Map<string, MesResumen & { _r: Set<number> }>();
  const obtener = (anioMes: string) => {
    if (!mapa.has(anioMes)) mapa.set(anioMes, { anioMes, cerrado: false, repartidores: 0, entregados: 0, dudosos: 0, _r: new Set() });
    return mapa.get(anioMes)!;
  };
  for (const m of meses) obtener(m.anioMes).cerrado = m.estado === "CERRADO";
  for (const r of registros) {
    const m = obtener(deFechaBD(r.fecha).slice(0, 7));
    m._r.add(r.repartidorId);
    m.entregados += entregados(r) ?? 0;
    if (r.estado !== "ok") m.dudosos++;
  }
  return [...mapa.values()]
    .map(({ _r, ...m }) => ({ ...m, repartidores: _r.size }))
    .filter((m) => m.repartidores > 0 || m.cerrado)
    .sort((a, b) => b.anioMes.localeCompare(a.anioMes));
}

export interface ResumenRepartidor {
  repartidorId: number;
  nombre: string;
  tarifa: TarifaUI;
  dias: number;
  entregados: number;
  dudosos: number;
  errores: number;
  sinDatos: number;
  /** Todos sus días del mes están marcados como revisados. */
  revisado: boolean;
  ajustes: number;
  pago: ResultadoPago;
}

export interface ResumenMes {
  anioMes: string;
  cerrado: boolean;
  repartidores: ResumenRepartidor[];
}

export async function resumenMes(prisma: PrismaClient, empresaId: number, anioMes: string): Promise<ResumenMes> {
  const [empresa, mes, registros] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } }),
    prisma.mes.findUnique({ where: { empresaId_anioMes: { empresaId, anioMes } }, include: { ajustes: true } }),
    prisma.registroDia.findMany({ where: { empresaId, fecha: rangoMes(anioMes) }, include: { repartidor: true } }),
  ]);
  const porRepartidor = new Map<number, typeof registros>();
  for (const r of registros) porRepartidor.set(r.repartidorId, [...(porRepartidor.get(r.repartidorId) ?? []), r]);

  const dias = diasDelMes(anioMes);
  const repartidores: ResumenRepartidor[] = [...porRepartidor.values()].map((rs) => {
    const rep = rs[0].repartidor;
    const totales = calcularTotales(rs);
    const tarifa = tarifaDe(rep);
    const ajustes = (mes?.ajustes ?? []).filter((a) => a.repartidorId === rep.id).map((a) => a.importe.toNumber());
    const conDatos = new Set(rs.map((r) => deFechaBD(r.fecha)));
    return {
      repartidorId: rep.id,
      nombre: rep.nombre,
      tarifa,
      dias: totales.diasTrabajados,
      entregados: totales.totalEntregados,
      dudosos: rs.filter((r) => r.estado === "dudoso").length,
      errores: rs.filter((r) => r.estado === "error").length,
      sinDatos: dias.filter((d) => empresa.diasLaborables.includes(d.diaSemana) && !conDatos.has(d.fecha)).length,
      revisado: rs.every((r) => r.revisado),
      ajustes: ajustes.reduce((s, a) => s + a, 0),
      pago: calcularPago(totales, tarifa, ajustes),
    };
  });
  repartidores.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { anioMes, cerrado: mes?.estado === "CERRADO", repartidores };
}

export function aRegistroUI(r: {
  id: number;
  fecha: Date;
  salida: number | null;
  vuelta: number | null;
  entregados: number | null;
  estado: "ok" | "dudoso" | "error";
  motivos: string[];
  notaIa: string | null;
  mensajeOriginal: string | null;
  editadoManual: boolean;
  revisado: boolean;
}): RegistroUI {
  return {
    id: r.id,
    fecha: deFechaBD(r.fecha),
    salida: r.salida,
    vuelta: r.vuelta,
    entregados: r.entregados,
    estado: r.estado,
    motivos: r.motivos,
    notaIa: r.notaIa,
    mensajeOriginal: r.mensajeOriginal,
    editadoManual: r.editadoManual,
    revisado: r.revisado,
  };
}

export async function detalleRepartidorMes(
  prisma: PrismaClient,
  empresaId: number,
  repartidorId: number,
  anioMes: string,
): Promise<DetalleRepartidorMes | null> {
  const repartidor = await prisma.repartidor.findFirst({ where: { id: repartidorId, empresaId } });
  if (!repartidor) return null;
  const [empresa, mes, registros] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } }),
    prisma.mes.findUnique({ where: { empresaId_anioMes: { empresaId, anioMes } }, include: { ajustes: { where: { repartidorId } } } }),
    prisma.registroDia.findMany({ where: { empresaId, repartidorId, fecha: rangoMes(anioMes) }, orderBy: { fecha: "asc" } }),
  ]);
  const porFecha = new Map(registros.map((r) => [deFechaBD(r.fecha), aRegistroUI(r)]));
  // Todos los días con datos + los laborables sin datos (en gris).
  const filas = diasDelMes(anioMes)
    .filter((d) => porFecha.has(d.fecha) || empresa.diasLaborables.includes(d.diaSemana))
    .map((d) => ({ fecha: d.fecha, registro: porFecha.get(d.fecha) ?? null }));
  return {
    repartidor: { id: repartidor.id, nombre: repartidor.nombre, tarifa: tarifaDe(repartidor) },
    anioMes,
    mesCerrado: mes?.estado === "CERRADO",
    filas,
    ajustes: (mes?.ajustes ?? []).reduce((s, a) => s + a.importe.toNumber(), 0),
  };
}
