"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { guardarCampoAction, marcarRevisadoAction } from "@/app/actions";
import { calcularPago, ETIQUETA_TARIFA, formatearEuros } from "@/calculo/pago";
import { calcularTotales } from "@/calculo/totales";
import { etiquetaDia } from "@/lib/fechas";
import type { DetalleRepartidorMes, FilaDia, RegistroUI } from "@/lib/tipos-ui";
import type { CampoEditado } from "@/validacion/edicion";

type Guardar = (fila: FilaDia, campo: CampoEditado, valor: number | null) => Promise<boolean>;

export function DetalleEditor({ detalle }: { detalle: DetalleRepartidorMes }) {
  const { repartidor, anioMes, mesCerrado, ajustes } = detalle;
  const [filas, setFilas] = useState<FilaDia[]>(detalle.filas);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const registros = useMemo(() => filas.flatMap((f) => (f.registro ? [f.registro] : [])), [filas]);
  const totales = useMemo(() => calcularTotales(registros), [registros]);
  const pago = useMemo(() => calcularPago(totales, repartidor.tarifa, ajustes ? [ajustes] : []), [totales, repartidor.tarifa, ajustes]);
  const dudosos = registros.filter((r) => r.estado === "dudoso").length;
  const errores = registros.filter((r) => r.estado === "error").length;
  const todoRevisado = registros.length > 0 && registros.every((r) => r.revisado);

  const guardar: Guardar = async (fila, campo, valor) => {
    setError(null);
    const r = await guardarCampoAction({
      registroId: fila.registro?.id ?? null,
      repartidorId: repartidor.id,
      fecha: fila.fecha,
      campo,
      valor,
    });
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setFilas((prev) => prev.map((f) => (f.fecha === fila.fecha ? { ...f, registro: r.registro } : f)));
    return true;
  };

  const alternarRevisado = () =>
    iniciar(async () => {
      const nuevo = !todoRevisado;
      const r = await marcarRevisadoAction(repartidor.id, anioMes, nuevo);
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      setFilas((prev) => prev.map((f) => (f.registro ? { ...f, registro: { ...f.registro, revisado: nuevo } } : f)));
    });

  return (
    <div className="space-y-3">
      {/* Totales: se recalculan al editar y se quedan a la vista */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:rounded-xl md:border md:bg-white md:p-4">
        <dl className="grid grid-cols-4 gap-2 text-center md:text-left">
          <Total etiqueta="Días" valor={String(totales.diasTrabajados)} />
          <Total etiqueta="Entregados" valor={String(totales.totalEntregados)} fuerte />
          <Total etiqueta="A pagar" valor={formatearEuros(pago.total)} fuerte />
          <Total
            etiqueta="Por revisar"
            valor={String(dudosos + errores)}
            aviso={dudosos + errores > 0}
          />
        </dl>
        <p className="mt-1 hidden text-xs text-gray-500 md:block">
          {ETIQUETA_TARIFA[repartidor.tarifa.tipo]}
          {ajustes !== 0 && ` · ajustes ${formatearEuros(ajustes)}`}
          {pago.base === 0 && " · ⚠ sin tarifa configurada"}
        </p>
      </div>

      {mesCerrado && <p className="rounded-lg bg-gray-200 p-3 text-sm text-gray-800">Mes cerrado: no se puede editar.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {/* Escritorio: tabla */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Salida</th>
              <th className="px-3 py-2">Vuelta</th>
              <th className="px-3 py-2">Entregados</th>
              <th className="px-3 py-2">Mensaje original</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaTabla key={f.fecha} fila={f} guardar={guardar} bloqueado={mesCerrado} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas */}
      <ul className="space-y-2 md:hidden">
        {filas.map((f) => (
          <TarjetaDia key={f.fecha} fila={f} guardar={guardar} bloqueado={mesCerrado} />
        ))}
      </ul>

      {!mesCerrado && registros.length > 0 && (
        <button
          type="button"
          onClick={alternarRevisado}
          disabled={pendiente}
          className={`w-full rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 ${
            todoRevisado ? "border border-gray-300 bg-white text-gray-800" : "bg-green-700 text-white"
          }`}
        >
          {todoRevisado ? "✓ Revisado · quitar marca" : "Marcar como revisado"}
        </button>
      )}
    </div>
  );
}

function Total({ etiqueta, valor, fuerte, aviso }: { etiqueta: string; valor: string; fuerte?: boolean; aviso?: boolean }) {
  return (
    <div className={aviso ? "rounded-md bg-amber-100 px-1" : ""}>
      <dt className="text-[11px] text-gray-500">{etiqueta}</dt>
      <dd className={`${fuerte ? "text-base font-bold md:text-xl" : "text-base font-semibold md:text-lg"}`}>{valor}</dd>
    </div>
  );
}

const ESTILO_FILA = {
  ok: "bg-white",
  dudoso: "bg-amber-50",
  error: "bg-red-50",
  vacio: "bg-gray-100 text-gray-500",
} as const;

function claveEstado(r: RegistroUI | null): keyof typeof ESTILO_FILA {
  return r ? r.estado : "vacio";
}

function Etiqueta({ r }: { r: RegistroUI | null }) {
  const base = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";
  if (!r) return <span className={`${base} bg-gray-200 text-gray-600`}>Sin datos</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {r.estado === "ok" && <span className={`${base} bg-green-100 text-green-800`}>OK</span>}
      {r.estado === "dudoso" && <span className={`${base} bg-amber-200 text-amber-900`}>Dudoso</span>}
      {r.estado === "error" && <span className={`${base} bg-red-200 text-red-900`}>Error</span>}
      {r.editadoManual && <span className={`${base} bg-blue-100 text-blue-800`}>Editado</span>}
    </span>
  );
}

function Avisos({ r }: { r: RegistroUI | null }) {
  if (!r || (r.estado === "ok" && !r.notaIa)) return null;
  return (
    <div className="space-y-0.5 text-xs">
      {r.estado !== "ok" && r.motivos.map((m) => <p key={m} className={r.estado === "error" ? "text-red-800" : "text-amber-900"}>⚠ {m}</p>)}
      {r.notaIa && <p className="text-gray-600">IA: {r.notaIa}</p>}
    </div>
  );
}

function FilaTabla({ fila, guardar, bloqueado }: { fila: FilaDia; guardar: Guardar; bloqueado: boolean }) {
  const r = fila.registro;
  return (
    <tr className={`border-t border-gray-100 align-top ${ESTILO_FILA[claveEstado(r)]}`}>
      <td className="whitespace-nowrap px-3 py-2 font-medium">{etiquetaDia(fila.fecha)}</td>
      <td className="px-3 py-2"><Celda etiqueta="Salida" valor={r?.salida ?? null} bloqueado={bloqueado} onGuardar={(v) => guardar(fila, "salida", v)} /></td>
      <td className="px-3 py-2"><Celda etiqueta="Vuelta" valor={r?.vuelta ?? null} bloqueado={bloqueado} onGuardar={(v) => guardar(fila, "vuelta", v)} /></td>
      <td className="px-3 py-2"><Celda etiqueta="Entregados" valor={r?.entregados ?? null} bloqueado={bloqueado} fuerte onGuardar={(v) => guardar(fila, "entregados", v)} /></td>
      <td className="max-w-xs px-3 py-2">
        <p className="whitespace-pre-line text-xs text-gray-700">{r?.mensajeOriginal ?? ""}</p>
        <Avisos r={r} />
      </td>
      <td className="px-3 py-2"><Etiqueta r={r} /></td>
    </tr>
  );
}

function TarjetaDia({ fila, guardar, bloqueado }: { fila: FilaDia; guardar: Guardar; bloqueado: boolean }) {
  const r = fila.registro;
  return (
    <li className={`rounded-xl border p-3 ${ESTILO_FILA[claveEstado(r)]} ${r?.estado === "dudoso" ? "border-amber-300" : r?.estado === "error" ? "border-red-300" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{etiquetaDia(fila.fecha)}</span>
        <Etiqueta r={r} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Celda etiqueta="Salida" valor={r?.salida ?? null} bloqueado={bloqueado} onGuardar={(v) => guardar(fila, "salida", v)} />
        <Celda etiqueta="Vuelta" valor={r?.vuelta ?? null} bloqueado={bloqueado} onGuardar={(v) => guardar(fila, "vuelta", v)} />
        <Celda etiqueta="Entregados" valor={r?.entregados ?? null} bloqueado={bloqueado} fuerte onGuardar={(v) => guardar(fila, "entregados", v)} />
      </div>
      <div className="mt-2"><Avisos r={r} /></div>
      {r?.mensajeOriginal && (
        <details className="mt-1 text-xs text-gray-600">
          <summary className="cursor-pointer select-none">Ver mensaje original</summary>
          <p className="mt-1 whitespace-pre-line rounded bg-white/70 p-2">{r.mensajeOriginal}</p>
        </details>
      )}
    </li>
  );
}

/** Celda numérica editable: guarda al salir del campo. Si el servidor rechaza el valor, vuelve al anterior. */
function Celda({
  etiqueta,
  valor,
  onGuardar,
  bloqueado,
  fuerte,
}: {
  etiqueta: string;
  valor: number | null;
  onGuardar: (valor: number | null) => Promise<boolean>;
  bloqueado: boolean;
  fuerte?: boolean;
}) {
  const aTexto = (v: number | null) => (v === null ? "" : String(v));
  const [texto, setTexto] = useState(aTexto(valor));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setTexto(aTexto(valor)), [valor]);

  async function alSalir() {
    const limpio = texto.trim();
    const nuevo = limpio === "" ? null : Number(limpio);
    if (nuevo !== null && (!Number.isInteger(nuevo) || nuevo < 0)) return setTexto(aTexto(valor));
    if (nuevo === valor) return setTexto(aTexto(valor));
    setGuardando(true);
    const ok = await onGuardar(nuevo);
    setGuardando(false);
    if (!ok) setTexto(aTexto(valor));
  }

  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-gray-500 md:hidden">{etiqueta}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={etiqueta}
        value={texto}
        disabled={bloqueado}
        placeholder="—"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={alSalir}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-base text-gray-900 disabled:bg-gray-100 md:w-20 md:text-sm ${
          fuerte ? "font-semibold" : ""
        } ${guardando ? "opacity-50" : ""}`}
      />
    </label>
  );
}
