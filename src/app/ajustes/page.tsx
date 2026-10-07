import { obtenerEmpresa } from "@/lib/empresa";
import { FormAjustes } from "@/components/FormAjustes";
import { guardarAjustesAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PaginaAjustes({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const empresa = await obtenerEmpresa();
  const { guardado } = await searchParams;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <FormAjustes
        accion={guardarAjustesAction}
        remitenteDueno={empresa.remitenteDueno ?? ""}
        diasLaborables={empresa.diasLaborables}
        guardado={guardado === "1"}
      />
    </div>
  );
}
