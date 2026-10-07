import Link from "next/link";
import { FormRepartidor } from "@/components/FormRepartidor";
import { crearRepartidorAction } from "@/app/actions";

export default function PaginaNuevoRepartidor() {
  return (
    <div className="space-y-3">
      <Link href="/repartidores" className="text-sm text-gray-500 hover:underline">← Repartidores</Link>
      <h1 className="text-xl font-semibold">Nuevo repartidor</h1>
      <FormRepartidor accion={crearRepartidorAction} textoBoton="Crear repartidor" />
    </div>
  );
}
