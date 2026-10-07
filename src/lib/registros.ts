import type { PrismaClient } from "../generated/prisma/client";
import { recalcularEdicion, type CampoEditado } from "../validacion/edicion";
import { aFechaBD, inicioMesSiguiente } from "./fechas";
import { aRegistroUI } from "./consultas";
import type { RegistroUI } from "./tipos-ui";

export class ErrorEdicion extends Error {}

const esValorValido = (v: number | null) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100000);

async function comprobarMesAbierto(prisma: PrismaClient, empresaId: number, fecha: string) {
  const mes = await prisma.mes.findUnique({ where: { empresaId_anioMes: { empresaId, anioMes: fecha.slice(0, 7) } } });
  if (mes?.estado === "CERRADO") throw new ErrorEdicion("El mes está cerrado. Reábrelo para editar.");
}

/** Edita salida, vuelta o entregados de un día. Recalcula entregados/estado y marca el cambio como manual. */
export async function actualizarRegistro(
  prisma: PrismaClient,
  empresaId: number,
  entrada: { registroId: number; campo: CampoEditado; valor: number | null },
): Promise<RegistroUI> {
  if (!esValorValido(entrada.valor)) throw new ErrorEdicion("El valor debe ser un número entero de 0 en adelante.");
  const actual = await prisma.registroDia.findFirst({ where: { id: entrada.registroId, empresaId } });
  if (!actual) throw new ErrorEdicion("Registro no encontrado.");
  await comprobarMesAbierto(prisma, empresaId, actual.fecha.toISOString().slice(0, 10));

  const resultado = recalcularEdicion(
    { salida: actual.salida, vuelta: actual.vuelta, entregados: actual.entregados, [entrada.campo]: entrada.valor },
    entrada.campo,
  );
  const guardado = await prisma.registroDia.update({
    where: { id: actual.id },
    data: { ...resultado, editadoManual: true },
  });
  return aRegistroUI(guardado);
}

/** Crea el registro de un día que no tenía datos (fila gris) al escribir un valor. */
export async function crearRegistroManual(
  prisma: PrismaClient,
  empresaId: number,
  entrada: { repartidorId: number; fecha: string; campo: CampoEditado; valor: number | null },
): Promise<RegistroUI> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha)) throw new ErrorEdicion("Fecha no válida.");
  if (!esValorValido(entrada.valor)) throw new ErrorEdicion("El valor debe ser un número entero de 0 en adelante.");
  const repartidor = await prisma.repartidor.findFirst({ where: { id: entrada.repartidorId, empresaId } });
  if (!repartidor) throw new ErrorEdicion("Repartidor no encontrado.");
  await comprobarMesAbierto(prisma, empresaId, entrada.fecha);

  const resultado = recalcularEdicion(
    { salida: null, vuelta: null, entregados: null, [entrada.campo]: entrada.valor },
    entrada.campo,
  );
  const guardado = await prisma.registroDia.upsert({
    where: { repartidorId_fecha: { repartidorId: repartidor.id, fecha: aFechaBD(entrada.fecha) } },
    create: {
      empresaId,
      repartidorId: repartidor.id,
      fecha: aFechaBD(entrada.fecha),
      ...resultado,
      editadoManual: true,
    },
    update: { ...resultado, editadoManual: true },
  });
  return aRegistroUI(guardado);
}

/** Marca (o desmarca) como revisados todos los días de un repartidor en el mes. */
export async function marcarRevisado(
  prisma: PrismaClient,
  empresaId: number,
  repartidorId: number,
  anioMes: string,
  revisado: boolean,
): Promise<number> {
  await comprobarMesAbierto(prisma, empresaId, `${anioMes}-01`);
  const { count } = await prisma.registroDia.updateMany({
    where: {
      empresaId,
      repartidorId,
      fecha: { gte: aFechaBD(`${anioMes}-01`), lt: aFechaBD(inicioMesSiguiente(anioMes)) },
    },
    data: { revisado },
  });
  return count;
}
