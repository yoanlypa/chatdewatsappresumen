/** Solo se vuelve a rutas internas (evita redirecciones a webs externas). */
export function destinoSeguro(volver: string | null | undefined): string {
  return volver && volver.startsWith("/") && !volver.startsWith("//") && !volver.includes("\\") ? volver : "/meses";
}
