import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, leerSesion } from "@/lib/sesion";

/**
 * Primera barrera: sin cookie de sesión válida no se entra a ninguna pantalla ni ruta API (salvo /login).
 * Es una comprobación rápida de la firma; la autorización real (usuario y empresa) se vuelve a hacer
 * en cada página, acción de servidor y ruta API.
 */
export async function proxy(request: NextRequest) {
  const sesion = await leerSesion(request.cookies.get(COOKIE_SESION)?.value);
  if (sesion) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }
  const destino = new URL("/login", request.url);
  const volverA = request.nextUrl.pathname + request.nextUrl.search;
  if (volverA !== "/") destino.searchParams.set("volver", volverA);
  return NextResponse.redirect(destino);
}

export const config = {
  // Todo menos el login, los archivos internos de Next y el icono.
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
