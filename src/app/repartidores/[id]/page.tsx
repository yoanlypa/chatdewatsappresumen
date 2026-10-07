import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { FormRepartidor } from "@/components/FormRepartidor";
import { guardarRepartidorAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PaginaEditarRepartidor({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const empresa = await obtenerEmpresa();
  const r = await prisma.repartidor.findFirst({ where: { id, empresaId: empresa.id } });
  if (!r) notFound();

  // Los importes se muestran con coma decimal y sin ceros sobrantes.
  const importe = (d: { toNumber(): number }) => (d.toNumber() === 0 ? "" : String(d.toNumber()).replace(".", ","));

  return (
    <div className="space-y-3">
      <Link href="/repartidores" className="text-sm text-gray-500 hover:underline">← Repartidores</Link>
      <h1 className="text-xl font-semibold">{r.nombre}</h1>
      <FormRepartidor
        accion={guardarRepartidorAction.bind(null, r.id)}
        mostrarActivo
        textoBoton="Guardar cambios"
        valores={{
          nombre: r.nombre,
          alias: r.aliasWhatsapp.join("\n"),
          tipoTarifa: r.tipoTarifa,
          tarifaPaquete: importe(r.tarifaPaquete),
          tarifaDia: importe(r.tarifaDia),
          tarifaFija: importe(r.tarifaFija),
          activo: r.activo,
        }}
      />
    </div>
  );
}
