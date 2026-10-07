import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { resumenMes } from "@/lib/consultas";
import { esAnioMes, etiquetaMes } from "@/lib/fechas";
import { ETIQUETA_TARIFA, formatearEuros } from "@/calculo/pago";

export const dynamic = "force-dynamic";

export default async function PaginaMes({ params }: { params: Promise<{ anioMes: string }> }) {
  const { anioMes } = await params;
  if (!esAnioMes(anioMes)) notFound();
  const empresa = await obtenerEmpresa();
  const mes = await resumenMes(prisma, empresa.id, anioMes);

  const totalEntregados = mes.repartidores.reduce((s, r) => s + r.entregados, 0);
  const totalPagar = mes.repartidores.reduce((s, r) => s + r.pago.total, 0);
  const porRevisar = mes.repartidores.reduce((s, r) => s + r.dudosos + r.errores, 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/meses" className="text-sm text-gray-500 hover:underline">← Meses</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold capitalize">{etiquetaMes(anioMes)}</h1>
          <div className="flex items-center gap-2">
            {mes.cerrado ? (
              <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">Mes cerrado</span>
            ) : (
              <Link href={`/importar?mes=${anioMes}`} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
                Subir más chats
              </Link>
            )}
          </div>
        </div>
      </div>

      {mes.repartidores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          No hay datos de este mes.{" "}
          <Link href={`/importar?mes=${anioMes}`} className="font-medium text-gray-900 underline">Subir chats</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Dato etiqueta="Entregados" valor={String(totalEntregados)} />
            <Dato etiqueta="A pagar" valor={formatearEuros(totalPagar)} />
            <Dato etiqueta="Por revisar" valor={String(porRevisar)} aviso={porRevisar > 0} />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {mes.repartidores.map((r) => (
              <li key={r.repartidorId}>
                <Link
                  href={`/meses/${anioMes}/${r.repartidorId}`}
                  className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold">{r.nombre}</h2>
                    {r.revisado ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">✓ Revisado</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Sin revisar</span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-gray-500">Días</dt><dd className="font-semibold">{r.dias}</dd></div>
                    <div><dt className="text-xs text-gray-500">Entregados</dt><dd className="font-semibold">{r.entregados}</dd></div>
                    <div><dt className="text-xs text-gray-500">A pagar</dt><dd className="font-semibold">{formatearEuros(r.pago.total)}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    {r.dudosos > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">{r.dudosos} dudoso{r.dudosos === 1 ? "" : "s"}</span>}
                    {r.errores > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{r.errores} con error</span>}
                    {r.dudosos === 0 && r.errores === 0 && <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">Sin dudas</span>}
                    {r.sinDatos > 0 && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{r.sinDatos} sin datos</span>}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {ETIQUETA_TARIFA[r.tarifa.tipo]}
                    {r.pago.base === 0 && " · ⚠ sin tarifa configurada"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor, aviso }: { etiqueta: string; valor: string; aviso?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${aviso ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="text-lg font-semibold">{valor}</p>
    </div>
  );
}
