import { redirect } from "next/navigation";
import { FormLogin } from "@/components/FormLogin";
import { sesionActual } from "@/lib/auth";
import { destinoSeguro } from "@/lib/destino";
import { iniciarSesionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const { volver } = await searchParams;
  const destino = destinoSeguro(volver);
  if (await sesionActual()) redirect(destino);

  return (
    <div className="mx-auto mt-10 max-w-sm space-y-4 md:mt-20">
      <div className="text-center">
        <p className="text-3xl" aria-hidden>🛵</p>
        <h1 className="mt-2 text-xl font-semibold">Liquidación de repartidores</h1>
        <p className="mt-1 text-sm text-gray-600">Inicia sesión para continuar</p>
      </div>
      <FormLogin accion={iniciarSesionAction} volver={destino} />
    </div>
  );
}
