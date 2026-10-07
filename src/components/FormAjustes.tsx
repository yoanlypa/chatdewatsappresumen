"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/app/actions";

// Orden de lunes a domingo; el valor es el día de la semana de JavaScript (0 = domingo).
const DIAS = [
  { valor: 1, etiqueta: "Lun" },
  { valor: 2, etiqueta: "Mar" },
  { valor: 3, etiqueta: "Mié" },
  { valor: 4, etiqueta: "Jue" },
  { valor: 5, etiqueta: "Vie" },
  { valor: 6, etiqueta: "Sáb" },
  { valor: 0, etiqueta: "Dom" },
];

export function FormAjustes({
  accion,
  remitenteDueno,
  diasLaborables,
  guardado,
}: {
  accion: (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;
  remitenteDueno: string;
  diasLaborables: number[];
  guardado: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);

  return (
    <form action={enviar} className="space-y-5 rounded-xl border border-gray-200 bg-white p-4">
      <label className="block text-sm font-medium">
        Tu nombre en los chats de WhatsApp
        <input
          name="remitenteDueno"
          defaultValue={remitenteDueno}
          placeholder="Se rellena al subir chats por primera vez"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
        />
        <span className="mt-1 block text-xs font-normal text-gray-500">
          Sirve para distinguirte del repartidor en cada chat. Debe ser exactamente como aparece en los mensajes.
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Días laborables</legend>
        <p className="mb-2 text-xs text-gray-500">Los días laborables sin datos se avisan en la revisión.</p>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <label key={d.valor} className="cursor-pointer">
              <input type="checkbox" name="diasLaborables" value={d.valor} defaultChecked={diasLaborables.includes(d.valor)} className="peer sr-only" />
              <span className="inline-block min-w-12 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm peer-checked:border-gray-900 peer-checked:bg-gray-900 peer-checked:text-white peer-focus-visible:ring-2">
                {d.etiqueta}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {estado?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{estado.error}</p>}
      {guardado && !estado?.error && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Guardado.</p>}

      <button type="submit" disabled={pendiente} className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
        {pendiente ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
