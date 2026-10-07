import { jwtVerify, SignJWT } from "jose";

/** Sesión en una cookie firmada (JWT HS256). Sin estado en el servidor: caduca sola. */
export const COOKIE_SESION = "sesion";
export const DURACION_SESION_SEG = 60 * 60 * 24 * 30; // 30 días

export interface DatosSesion {
  usuarioId: number;
  empresaId: number;
}

function clave(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (secreto && secreto.length >= 32) return new TextEncoder().encode(secreto);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta la variable SESSION_SECRET (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode("clave-solo-para-desarrollo-local-no-usar-en-produccion");
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ uid: datos.usuarioId, eid: datos.empresaId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(clave());
}

/** Devuelve los datos si el token es válido y no ha caducado; null en cualquier otro caso. */
export async function leerSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    if (!Number.isInteger(payload.uid) || !Number.isInteger(payload.eid)) return null;
    return { usuarioId: payload.uid as number, empresaId: payload.eid as number };
  } catch {
    return null;
  }
}
