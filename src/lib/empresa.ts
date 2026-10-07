import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { sesionActual } from "./auth";

/**
 * Empresa del usuario con sesión. Sin sesión redirige al login (páginas y acciones de servidor).
 * Todo el acceso a datos recibe `empresaId`, así que cada empresa solo ve lo suyo.
 */
export async function obtenerEmpresa() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");
  return prisma.empresa.findUniqueOrThrow({ where: { id: sesion.empresaId } });
}

/** Igual, pero para rutas API: devuelve null si no hay sesión (la ruta responde 401). */
export async function obtenerEmpresaApi() {
  const sesion = await sesionActual();
  return sesion ? prisma.empresa.findUniqueOrThrow({ where: { id: sesion.empresaId } }) : null;
}
