"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { actualizarRegistro, crearRegistroManual, ErrorEdicion, marcarRevisado } from "@/lib/registros";
import type { CampoEditado } from "@/validacion/edicion";
import type { RegistroUI } from "@/lib/tipos-ui";

export type RespuestaCampo = { ok: true; registro: RegistroUI } | { ok: false; error: string };

/** Guarda una celda (salida, vuelta o entregados) de un día; si el día estaba vacío, lo crea. */
export async function guardarCampoAction(entrada: {
  registroId: number | null;
  repartidorId: number;
  fecha: string;
  campo: CampoEditado;
  valor: number | null;
}): Promise<RespuestaCampo> {
  const empresa = await obtenerEmpresa();
  try {
    const registro = entrada.registroId
      ? await actualizarRegistro(prisma, empresa.id, { registroId: entrada.registroId, campo: entrada.campo, valor: entrada.valor })
      : await crearRegistroManual(prisma, empresa.id, {
          repartidorId: entrada.repartidorId,
          fecha: entrada.fecha,
          campo: entrada.campo,
          valor: entrada.valor,
        });
    revalidatePath("/meses", "layout");
    return { ok: true, registro };
  } catch (e) {
    if (e instanceof ErrorEdicion) return { ok: false, error: e.message };
    console.error("guardarCampo:", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

export async function marcarRevisadoAction(
  repartidorId: number,
  anioMes: string,
  revisado: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const empresa = await obtenerEmpresa();
  try {
    await marcarRevisado(prisma, empresa.id, repartidorId, anioMes, revisado);
    revalidatePath("/meses", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ErrorEdicion ? e.message : "No se pudo guardar." };
  }
}

// ---------- Repartidores ----------

const numero = z
  .string()
  .trim()
  .transform((s) => (s === "" ? 0 : Number(s.replace(",", "."))))
  .pipe(z.number().min(0, "Los importes no pueden ser negativos").max(1_000_000));

const RepartidorSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre").max(100),
  alias: z.string().default(""),
  tipoTarifa: z.enum(["POR_PAQUETE", "POR_DIA", "FIJO_MAS_VARIABLE"]),
  tarifaPaquete: numero,
  tarifaDia: numero,
  tarifaFija: numero,
});

export type EstadoFormulario = { error?: string } | undefined;

function leerRepartidor(form: FormData) {
  const r = RepartidorSchema.safeParse({
    nombre: form.get("nombre") ?? "",
    alias: form.get("alias") ?? "",
    tipoTarifa: form.get("tipoTarifa") ?? "POR_PAQUETE",
    tarifaPaquete: form.get("tarifaPaquete") ?? "",
    tarifaDia: form.get("tarifaDia") ?? "",
    tarifaFija: form.get("tarifaFija") ?? "",
  });
  if (!r.success) return { error: r.error.issues[0].message } as const;
  const alias = [...new Set(r.data.alias.split(/[\n,;]/).map((a) => a.trim()).filter(Boolean))];
  return { datos: { ...r.data, alias, activo: form.get("activo") === "on" } } as const;
}

export async function crearRepartidorAction(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const empresa = await obtenerEmpresa();
  const l = leerRepartidor(form);
  if ("error" in l) return { error: l.error };
  const { alias, ...resto } = l.datos;
  await prisma.repartidor.create({ data: { empresaId: empresa.id, ...resto, aliasWhatsapp: alias, activo: true } });
  revalidatePath("/repartidores");
  redirect("/repartidores");
}

export async function guardarRepartidorAction(id: number, _: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const empresa = await obtenerEmpresa();
  const l = leerRepartidor(form);
  if ("error" in l) return { error: l.error };
  const { alias, ...resto } = l.datos;
  const { count } = await prisma.repartidor.updateMany({
    where: { id, empresaId: empresa.id },
    data: { ...resto, aliasWhatsapp: alias },
  });
  if (!count) return { error: "Repartidor no encontrado." };
  revalidatePath("/", "layout");
  redirect("/repartidores");
}

// ---------- Ajustes de la empresa ----------

export async function guardarAjustesAction(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const empresa = await obtenerEmpresa();
  const dias = form.getAll("diasLaborables").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (dias.length === 0) return { error: "Elige al menos un día laborable." };
  await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      remitenteDueno: String(form.get("remitenteDueno") ?? "").trim() || null,
      diasLaborables: [...new Set(dias)].sort(),
    },
  });
  revalidatePath("/", "layout");
  redirect("/ajustes?guardado=1");
}
