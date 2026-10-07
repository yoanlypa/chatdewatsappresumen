import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { tarifaDe } from "@/lib/consultas";
import { ETIQUETA_TARIFA, formatearEuros } from "@/calculo/pago";

export const dynamic = "force-dynamic";

export default async function PaginaRepartidores() {
  const empresa = await obtenerEmpresa();
  const repartidores = await prisma.repartidor.findMany({ where: { empresaId: empresa.id }, orderBy: { nombre: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Repartidores</h1>
        <Link href="/repartidores/nuevo" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          Añadir
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        Se crean solos al subir sus chats. Aquí configuras cuánto cobra cada uno y otros nombres con los que aparece en WhatsApp.
      </p>

      {repartidores.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          Aún no hay repartidores.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {repartidores.map((r) => {
            const t = tarifaDe(r);
            const detalle =
              t.tipo === "POR_PAQUETE" ? `${formatearEuros(t.tarifaPaquete)} por paquete`
              : t.tipo === "POR_DIA" ? `${formatearEuros(t.tarifaDia)} por día`
              : `${formatearEuros(t.tarifaFija)} fijos + ${formatearEuros(t.tarifaPaquete)} por paquete`;
            const sinTarifa = t.tarifaPaquete === 0 && t.tarifaDia === 0 && t.tarifaFija === 0;
            return (
              <li key={r.id}>
                <Link href={`/repartidores/${r.id}`} className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold">{r.nombre}</span>
                    {!r.activo && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Inactivo</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{ETIQUETA_TARIFA[t.tipo]}</p>
                  <p className={`text-sm ${sinTarifa ? "font-medium text-amber-800" : "text-gray-900"}`}>
                    {sinTarifa ? "⚠ Sin tarifa configurada" : detalle}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
