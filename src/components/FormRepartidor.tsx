"use client";

import { useActionState, useState } from "react";
import type { EstadoFormulario } from "@/app/actions";
import { ETIQUETA_TARIFA, type TipoTarifa } from "@/calculo/pago";

interface Valores {
  nombre: string;
  alias: string;
  tipoTarifa: TipoTarifa;
  tarifaPaquete: string;
  tarifaDia: string;
  tarifaFija: string;
  activo: boolean;
}

const VACIO: Valores = { nombre: "", alias: "", tipoTarifa: "POR_PAQUETE", tarifaPaquete: "", tarifaDia: "", tarifaFija: "", activo: true };

export function FormRepartidor({
  accion,
  valores = VACIO,
  mostrarActivo = false,
  textoBoton,
}: {
  accion: (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;
  valores?: Valores;
  mostrarActivo?: boolean;
  textoBoton: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const [tipo, setTipo] = useState<TipoTarifa>(valores.tipoTarifa);
  const campo = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base";

  return (
    <form action={enviar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <label className="block text-sm font-medium">
        Nombre
        <input name="nombre" defaultValue={valores.nombre} required maxLength={100} className={campo} />
      </label>

      <label className="block text-sm font-medium">
        Otros nombres en WhatsApp <span className="font-normal text-gray-500">(uno por línea)</span>
        <textarea name="alias" defaultValue={valores.alias} rows={2} className={campo} placeholder="Por si el contacto cambia de nombre" />
      </label>

      <label className="block text-sm font-medium">
        Cómo se le paga
        <select name="tipoTarifa" value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarifa)} className={campo}>
          {(Object.keys(ETIQUETA_TARIFA) as TipoTarifa[]).map((t) => (
            <option key={t} value={t}>{ETIQUETA_TARIFA[t]}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={`block text-sm font-medium ${tipo === "POR_DIA" ? "hidden" : ""}`}>
          € por paquete entregado
          <input name="tarifaPaquete" defaultValue={valores.tarifaPaquete} inputMode="decimal" placeholder="0,50" className={campo} />
        </label>
        <label className={`block text-sm font-medium ${tipo === "POR_DIA" ? "" : "hidden"}`}>
          € por día trabajado
          <input name="tarifaDia" defaultValue={valores.tarifaDia} inputMode="decimal" placeholder="40" className={campo} />
        </label>
        <label className={`block text-sm font-medium ${tipo === "FIJO_MAS_VARIABLE" ? "" : "hidden"}`}>
          € fijos al mes
          <input name="tarifaFija" defaultValue={valores.tarifaFija} inputMode="decimal" placeholder="300" className={campo} />
        </label>
      </div>

      {mostrarActivo && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={valores.activo} className="size-4" />
          Repartidor activo
        </label>
      )}

      {estado?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{estado.error}</p>}

      <button type="submit" disabled={pendiente} className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
        {pendiente ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
