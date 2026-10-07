import bcrypt from "bcryptjs";
import type { PrismaClient } from "../generated/prisma/client";

export const LONGITUD_MINIMA_CONTRASENA = 10;
const COSTE = 12;

// Hash de una contraseña inventada: se compara aunque el email no exista, para que no se note por el tiempo.
const HASH_FALSO = bcrypt.hashSync("no-existe-este-usuario", COSTE);

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export async function hashearContrasena(contrasena: string, coste = COSTE): Promise<string> {
  return bcrypt.hash(contrasena, coste);
}

/** Usuario si el email y la contraseña son correctos; null si no (sin distinguir cuál falló). */
export async function verificarCredenciales(prisma: PrismaClient, email: string, contrasena: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });
  const correcta = await bcrypt.compare(contrasena, usuario?.passwordHash ?? HASH_FALSO);
  return usuario && correcta ? usuario : null;
}

export class ErrorUsuario extends Error {}

/**
 * Crea un usuario (el dueño). Si todavía no hay empresa, la crea; si la hay, lo asocia a la primera.
 * No hay registro público: los usuarios se crean solo con el script `npm run crear-usuario`.
 */
export async function crearUsuario(
  prisma: PrismaClient,
  datos: { email: string; contrasena: string; nombreEmpresa?: string; coste?: number },
) {
  const email = normalizarEmail(datos.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorUsuario("El email no es válido.");
  if (datos.contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new ErrorUsuario(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`);
  }
  if (await prisma.usuario.findUnique({ where: { email } })) throw new ErrorUsuario("Ya existe un usuario con ese email.");

  const empresa =
    (await prisma.empresa.findFirst({ orderBy: { id: "asc" } })) ??
    (await prisma.empresa.create({ data: { nombre: datos.nombreEmpresa?.trim() || "Mi empresa" } }));
  return prisma.usuario.create({
    data: { empresaId: empresa.id, email, passwordHash: await hashearContrasena(datos.contrasena, datos.coste) },
  });
}

/** Cambia la contraseña de un usuario existente. */
export async function cambiarContrasena(prisma: PrismaClient, email: string, contrasena: string, coste?: number) {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    throw new ErrorUsuario(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`);
  }
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });
  if (!usuario) throw new ErrorUsuario("No existe ese usuario.");
  await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash: await hashearContrasena(contrasena, coste) } });
}
