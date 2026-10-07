import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { detalleRepartidorMes } from "@/lib/consultas";
import { esAnioMes, etiquetaMes } from "@/lib/fechas";
import { DetalleEditor } from "@/components/DetalleEditor";

export const dynamic = "force-dynamic";

export default async function PaginaDetalle({ params }: { params: Promise<{ anioMes: string; repartidorId: string }> }) {
  const { anioMes, repartidorId } = await params;
  const id = Number(repartidorId);
  if (!esAnioMes(anioMes) || !Number.isInteger(id)) notFound();
  const empresa = await obtenerEmpresa();
  const detalle = await detalleRepartidorMes(prisma, empresa.id, id, anioMes);
  if (!detalle) notFound();

  return (
    <div className="space-y-3">
      <div>
        <Link href={`/meses/${anioMes}`} className="text-sm text-gray-500 hover:underline">← {etiquetaMes(anioMes)}</Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{detalle.repartidor.nombre}</h1>
          <Link href={`/repartidores/${detalle.repartidor.id}`} className="text-sm text-gray-500 underline">Tarifa</Link>
        </div>
      </div>
      <DetalleEditor detalle={detalle} />
    </div>
  );
}
