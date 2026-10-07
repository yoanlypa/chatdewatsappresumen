import { obtenerEmpresa } from "@/lib/empresa";
import { FormAjustes } from "@/components/FormAjustes";
import { guardarAjustesAction } from "@/app/actions";
import { cerrarSesionAction } from "@/app/login/actions";
import { sesionActual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PaginaAjustes({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const empresa = await obtenerEmpresa();
  const { guardado } = await searchParams;
  const sesion = await sesionActual();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <FormAjustes
        accion={guardarAjustesAction}
        remitenteDueno={empresa.remitenteDueno ?? ""}
        diasLaborables={empresa.diasLaborables}
        guardado={guardado === "1"}
      />
      <form action={cerrarSesionAction} className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm text-gray-600">Sesión iniciada como <strong>{sesion?.email}</strong></p>
        <button type="submit" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-800">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
