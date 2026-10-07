import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerEmpresa } from "@/lib/empresa";
import { listarMeses } from "@/lib/consultas";
import { etiquetaMes } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export default async function PaginaMeses() {
  const empresa = await obtenerEmpresa();
  const meses = await listarMeses(prisma, empresa.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Meses</h1>
        <Link href="/importar" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
          Subir chats
        </Link>
      </div>

      {meses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium">Todavía no hay nada importado</p>
          <p className="mt-1 text-sm text-gray-600">
            Exporta el chat de cada repartidor desde WhatsApp (sin archivos) y súbelos aquí.
          </p>
          <Link href="/importar" className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            Subir los primeros chats
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {meses.map((m) => (
            <li key={m.anioMes}>
              <Link
                href={`/meses/${m.anioMes}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold capitalize">{etiquetaMes(m.anioMes)}</span>
                  {m.cerrado ? (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">Cerrado</span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Abierto</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {m.repartidores} repartidor{m.repartidores === 1 ? "" : "es"} ·{" "}
                  <strong className="text-gray-900">{m.entregados}</strong> entregados
                </p>
                {m.dudosos > 0 && (
                  <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    {m.dudosos} día{m.dudosos === 1 ? "" : "s"} por revisar
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
