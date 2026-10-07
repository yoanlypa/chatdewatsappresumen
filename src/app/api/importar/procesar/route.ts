import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresaApi } from "@/lib/empresa";
import { ErrorImportacion, procesarArchivo } from "@/lib/importar";
import { esAnioMes } from "@/lib/fechas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La extracción con IA de un mes entero puede tardar; el cliente envía un archivo por petición.
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

/** Procesa UN archivo: lector → IA → validaciones → guarda. El archivo original no se guarda. */
export async function POST(request: Request) {
  const form = await request.formData();
  const anioMes = String(form.get("anioMes") ?? "");
  const archivo = form.get("archivo");
  if (!esAnioMes(anioMes) || !(archivo instanceof File)) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera los 25 MB." }, { status: 400 });

  const empresa = await obtenerEmpresaApi();
  if (!empresa) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  try {
    const resultado = await procesarArchivo(
      prisma,
      empresa.id,
      { nombre: archivo.name, datos: new Uint8Array(await archivo.arrayBuffer()) },
      { anioMes, dueno: String(form.get("dueno") ?? "").trim() || null },
    );
    return NextResponse.json(resultado);
  } catch (e) {
    const mensaje = e instanceof ErrorImportacion ? e.message : "Error inesperado al procesar el archivo.";
    if (!(e instanceof ErrorImportacion)) console.error("procesar:", e);
    return NextResponse.json({ error: mensaje }, { status: e instanceof ErrorImportacion ? 422 : 500 });
  }
}
