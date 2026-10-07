import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { COOKIE_SESION, DURACION_SESION_SEG, firmarSesion, leerSesion } from "./sesion";

/**
 * Usuario con sesión válida, o null. Además de la firma de la cookie, comprueba que el usuario sigue
 * existiendo en la base de datos (si se borra un usuario, pierde el acceso al momento).
 */
export async function sesionActual() {
  const almacen = await cookies();
  const datos = await leerSesion(almacen.get(COOKIE_SESION)?.value);
  if (!datos) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id: datos.usuarioId } });
  if (!usuario || usuario.empresaId !== datos.empresaId) return null;
  return { usuarioId: usuario.id, empresaId: usuario.empresaId, email: usuario.email };
}

export async function abrirSesion(usuario: { id: number; empresaId: number }) {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, await firmarSesion({ usuarioId: usuario.id, empresaId: usuario.empresaId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });
}

export async function cerrarSesionCookie() {
  (await cookies()).delete(COOKIE_SESION);
}
