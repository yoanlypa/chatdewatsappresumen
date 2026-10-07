import type { PrismaClient } from "../generated/prisma/client";
import {
  detectarDueno,
  identificarRepartidor,
  leerArchivoChat,
  normalizarNombre,
  parsearChat,
  remitentesDe,
  filtrarMensajes,
  type Mensaje,
} from "../lector";
import { extraerRegistros, type ClienteIA } from "../ia/extraer";
import { mensajesParaIA } from "../ia/preparar";
import { validarRegistros } from "../validacion/validar";
import { calcularTotales } from "../calculo/totales";
import { aFechaBD, inicioMesSiguiente } from "./fechas";

export interface ArchivoEntrada {
  nombre: string;
  datos: Uint8Array;
}

export interface AnalisisArchivo {
  nombre: string;
  error: string | null;
  remitentes: string[];
  /** Remitente del chat que corresponde al repartidor (no al dueño). */
  remitenteRepartidor: string | null;
  nombreDetectado: string | null;
  /** Repartidor ya dado de alta que coincide por nombre o alias; null si es nuevo. */
  repartidorId: number | null;
  mensajesEnMes: number;
  /** Datos que ya hay guardados de ese repartidor en el mes (se reemplazarían al importar). */
  existentes: { registros: number; editados: number; revisados: number } | null;
}

export interface Analisis {
  /** Remitente del dueño; null si hay que pedir confirmación. */
  dueno: string | null;
  duenoSeguro: boolean;
  /** El dueño ya está guardado en los ajustes y coincide: no hace falta pedir confirmación. */
  duenoConfirmado: boolean;
  candidatosDueno: string[];
  mesCerrado: boolean;
  archivos: AnalisisArchivo[];
}

interface ChatLeido {
  nombre: string;
  mensajes: Mensaje[];
  error: string | null;
}

async function leer(archivo: ArchivoEntrada): Promise<ChatLeido> {
  try {
    const { texto } = await leerArchivoChat(archivo.nombre, archivo.datos);
    const mensajes = parsearChat(texto);
    return {
      nombre: archivo.nombre,
      mensajes,
      error: mensajes.length ? null : "No se encontraron mensajes. ¿Es un chat exportado de WhatsApp?",
    };
  } catch (e) {
    return { nombre: archivo.nombre, mensajes: [], error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
}

const rangoMes = (anioMes: string) => ({ gte: aFechaBD(`${anioMes}-01`), lt: aFechaBD(inicioMesSiguiente(anioMes)) });

/** Paso rápido y sin IA: lee los archivos, detecta al dueño y a cada repartidor y avisa de lo que se pisaría. */
export async function analizarArchivos(
  prisma: PrismaClient,
  empresaId: number,
  archivos: ArchivoEntrada[],
  anioMes: string,
  duenoElegido?: string | null,
): Promise<Analisis> {
  const [empresa, repartidores, mes] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } }),
    prisma.repartidor.findMany({ where: { empresaId } }),
    prisma.mes.findUnique({ where: { empresaId_anioMes: { empresaId, anioMes } } }),
  ]);
  const chats = await Promise.all(archivos.map(leer));
  const validos = chats.filter((c) => !c.error);
  const duenoInfo = detectarDueno(
    validos.map((c) => remitentesDe(c.mensajes)),
    duenoElegido ?? empresa.remitenteDueno,
  );

  const resultado: AnalisisArchivo[] = [];
  for (const chat of chats) {
    const remitentes = remitentesDe(chat.mensajes);
    const id = chat.error
      ? { remitente: null, nombreDetectado: null, repartidorId: null }
      : identificarRepartidor({
          nombreArchivo: chat.nombre,
          remitentes,
          dueno: duenoInfo.remitente,
          repartidores: repartidores.map((r) => ({ id: r.id, nombre: r.nombre, aliasWhatsapp: r.aliasWhatsapp })),
        });
    let error = chat.error;
    if (!error && !id.remitente) {
      error = duenoInfo.remitente
        ? "No pude saber quién es el repartidor en este chat."
        : "Confirma quién eres tú (el dueño) para identificar al repartidor.";
    }
    const mensajesEnMes = id.remitente ? filtrarMensajes(chat.mensajes, id.remitente, anioMes).length : 0;

    let existentes: AnalisisArchivo["existentes"] = null;
    if (id.repartidorId) {
      const where = { repartidorId: id.repartidorId, fecha: rangoMes(anioMes) };
      const [registros, editados, revisados] = await Promise.all([
        prisma.registroDia.count({ where }),
        prisma.registroDia.count({ where: { ...where, editadoManual: true } }),
        prisma.registroDia.count({ where: { ...where, revisado: true } }),
      ]);
      existentes = registros ? { registros, editados, revisados } : null;
    }
    resultado.push({
      nombre: chat.nombre,
      error,
      remitentes,
      remitenteRepartidor: id.remitente,
      nombreDetectado: id.nombreDetectado,
      repartidorId: id.repartidorId,
      mensajesEnMes,
      existentes,
    });
  }

  return {
    dueno: duenoInfo.remitente,
    duenoSeguro: duenoInfo.seguro,
    duenoConfirmado:
      !!duenoInfo.remitente &&
      !!empresa.remitenteDueno &&
      normalizarNombre(empresa.remitenteDueno) === normalizarNombre(duenoInfo.remitente),
    candidatosDueno: duenoInfo.candidatos,
    mesCerrado: mes?.estado === "CERRADO",
    archivos: resultado,
  };
}

export interface ResultadoProcesado {
  repartidorId: number;
  repartidor: string;
  dias: number;
  entregados: number;
  dudosos: number;
  errores: number;
  sinDatos: number;
  uso: { entrada: number; salida: number; llamadas: number };
}

export class ErrorImportacion extends Error {}

type OpcionesProcesar = { anioMes: string; dueno: string | null; cliente?: ClienteIA; modelo?: string };

/**
 * Mes de la empresa, creándolo si no existe. Si varios archivos se procesan a la vez, todos intentan
 * crearlo al mismo tiempo: el que pierde la carrera (violación de unicidad) simplemente lo lee.
 */
async function obtenerMes(prisma: PrismaClient, empresaId: number, anioMes: string) {
  const clave = { empresaId_anioMes: { empresaId, anioMes } };
  const existente = await prisma.mes.findUnique({ where: clave });
  if (existente) return existente;
  try {
    return await prisma.mes.create({ data: { empresaId, anioMes } });
  } catch (e) {
    const otro = await prisma.mes.findUnique({ where: clave });
    if (otro) return otro;
    throw e;
  }
}

/** Procesa un archivo: lector → IA → validaciones → guarda los registros del repartidor en el mes. */
export async function procesarArchivo(
  prisma: PrismaClient,
  empresaId: number,
  archivo: ArchivoEntrada,
  opciones: OpcionesProcesar,
): Promise<ResultadoProcesado> {
  const importacion = await prisma.importacion.create({
    data: { empresaId, nombreArchivo: archivo.nombre, estado: "PENDIENTE" },
  });
  try {
    return await ejecutar(prisma, empresaId, archivo, opciones, importacion.id);
  } catch (e) {
    // Cualquier fallo queda anotado en la importación, también los inesperados.
    const mensaje = e instanceof ErrorImportacion ? e.message : `Error inesperado: ${e instanceof Error ? e.message : String(e)}`;
    await prisma.importacion.update({ where: { id: importacion.id }, data: { estado: "ERROR", error: mensaje } }).catch(() => {});
    throw e;
  }
}

async function ejecutar(
  prisma: PrismaClient,
  empresaId: number,
  archivo: ArchivoEntrada,
  opciones: OpcionesProcesar,
  importacionId: number,
): Promise<ResultadoProcesado> {
  const { anioMes } = opciones;
  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
  const fallar = (mensaje: string): never => {
    throw new ErrorImportacion(mensaje);
  };

  const mes = await obtenerMes(prisma, empresaId, anioMes);
  if (mes.estado === "CERRADO") return fallar("El mes está cerrado. Reábrelo para importar.");

  const chat = await leer(archivo);
  if (chat.error) return fallar(chat.error);

  const repartidores = await prisma.repartidor.findMany({ where: { empresaId } });
  const id = identificarRepartidor({
    nombreArchivo: archivo.nombre,
    remitentes: remitentesDe(chat.mensajes),
    dueno: opciones.dueno,
    repartidores: repartidores.map((r) => ({ id: r.id, nombre: r.nombre, aliasWhatsapp: r.aliasWhatsapp })),
  });
  if (!id.remitente) return fallar("No pude saber quién es el repartidor en este chat.");

  let repartidor = repartidores.find((r) => r.id === id.repartidorId);
  if (!repartidor) {
    const nombre = id.nombreDetectado ?? id.remitente;
    repartidor = await prisma.repartidor.create({
      data: {
        empresaId,
        nombre,
        aliasWhatsapp: normalizarNombre(nombre) === normalizarNombre(id.remitente) ? [] : [id.remitente],
      },
    });
  }
  await prisma.importacion.update({
    where: { id: importacionId },
    data: { repartidorId: repartidor.id, repartidorDetectado: id.remitente },
  });

  let extraccion;
  try {
    extraccion = await extraerRegistros(mensajesParaIA(chat.mensajes, id.remitente, anioMes), anioMes, {
      cliente: opciones.cliente,
      modelo: opciones.modelo,
    });
  } catch (e) {
    return fallar(`Falló la extracción con IA: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { registros, avisos } = validarRegistros(extraccion.registros, {
    anioMes,
    diasLaborables: empresa.diasLaborables,
  });

  await prisma.$transaction([
    prisma.registroDia.deleteMany({ where: { repartidorId: repartidor.id, fecha: rangoMes(anioMes) } }),
    prisma.registroDia.createMany({
      data: registros.map((r) => ({
        empresaId,
        repartidorId: repartidor.id,
        fecha: aFechaBD(r.fecha),
        salida: r.salida,
        vuelta: r.vuelta,
        entregados: r.entregados,
        estado: r.estado,
        motivos: r.motivos,
        notaIa: r.notaIa,
        mensajeOriginal: r.mensajeOriginal,
      })),
    }),
    prisma.importacion.update({ where: { id: importacionId }, data: { estado: "PROCESADA" } }),
  ]);

  const totales = calcularTotales(registros);
  return {
    repartidorId: repartidor.id,
    repartidor: repartidor.nombre,
    dias: totales.diasTrabajados,
    entregados: totales.totalEntregados,
    dudosos: registros.filter((r) => r.estado === "dudoso").length,
    errores: registros.filter((r) => r.estado === "error").length,
    sinDatos: avisos.length,
    uso: extraccion.uso,
  };
}
