import { prisma } from "./prisma";

/**
 * Empresa con la que se trabaja. De momento solo hay una; en la Fase 5 saldrá del usuario con sesión.
 * Todo el acceso a datos recibe `empresaId`, así que añadir más empresas no cambia el resto del código.
 */
export async function obtenerEmpresa() {
  const existente = await prisma.empresa.findFirst({ orderBy: { id: "asc" } });
  return existente ?? prisma.empresa.create({ data: { nombre: "Mi empresa" } });
}
