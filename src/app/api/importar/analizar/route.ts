import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { analizarArchivos } from "@/lib/importar";
import { esAnioMes } from "@/lib/fechas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ARCHIVOS = 40;
const MAX_BYTES = 25 * 1024 * 1024;

/** Paso rápido (sin IA): lee los archivos subidos y devuelve quién es el dueño y cada repartidor. */
export async function POST(request: Request) {
  const form = await request.formData();
  const anioMes = String(form.get("anioMes") ?? "");
  if (!esAnioMes(anioMes)) return NextResponse.json({ error: "Elige un mes válido." }, { status: 400 });

  const ficheros = form.getAll("archivos").filter((f): f is File => f instanceof File);
  if (ficheros.length === 0) return NextResponse.json({ error: "Sube al menos un archivo." }, { status: 400 });
  if (ficheros.length > MAX_ARCHIVOS) return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS} archivos a la vez.` }, { status: 400 });
  if (ficheros.some((f) => f.size > MAX_BYTES)) return NextResponse.json({ error: "Algún archivo supera los 25 MB." }, { status: 400 });

  const archivos = await Promise.all(
    ficheros.map(async (f) => ({ nombre: f.name, datos: new Uint8Array(await f.arrayBuffer()) })),
  );
  const empresa = await obtenerEmpresa();
  const dueno = String(form.get("dueno") ?? "").trim() || null;
  const analisis = await analizarArchivos(prisma, empresa.id, archivos, anioMes, dueno);

  // Si el usuario confirmó quién es el dueño, se guarda para las próximas veces.
  if (dueno && form.get("guardarDueno") === "1" && analisis.dueno === dueno && empresa.remitenteDueno !== dueno) {
    await prisma.empresa.update({ where: { id: empresa.id }, data: { remitenteDueno: dueno } });
    analisis.duenoConfirmado = true;
  }
  return NextResponse.json(analisis);
}
