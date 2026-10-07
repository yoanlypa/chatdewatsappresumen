"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Analisis, ResultadoProcesado } from "@/lib/importar";
import { etiquetaMes } from "@/lib/fechas";

type EstadoArchivo =
  | { fase: "pendiente" }
  | { fase: "procesando" }
  | { fase: "ok"; resultado: ResultadoProcesado }
  | { fase: "error"; mensaje: string };

const CONCURRENCIA = 3;

export function ImportarChats({ mesInicial }: { mesInicial: string }) {
  const [mes, setMes] = useState(mesInicial);
  const [ficheros, setFicheros] = useState<File[]>([]);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [duenoSel, setDuenoSel] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estados, setEstados] = useState<EstadoArchivo[] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const reiniciarAnalisis = () => {
    setAnalisis(null);
    setEstados(null);
    setError(null);
  };

  async function analizar(dueno?: string, guardar = false) {
    setTrabajando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("anioMes", mes);
      ficheros.forEach((f) => form.append("archivos", f));
      if (dueno) form.set("dueno", dueno);
      if (guardar) form.set("guardarDueno", "1");
      const r = await fetch("/api/importar/analizar", { method: "POST", body: form });
      if (r.status === 401) return void (window.location.href = "/login?volver=/importar");
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error ?? "No se pudieron leer los archivos.");
      setAnalisis(datos);
      setDuenoSel(datos.dueno ?? datos.candidatosDueno?.[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer los archivos.");
    } finally {
      setTrabajando(false);
    }
  }

  async function procesar() {
    if (!analisis) return;
    const iniciales: EstadoArchivo[] = analisis.archivos.map(() => ({ fase: "pendiente" }));
    setEstados(iniciales);
    setTrabajando(true);
    setError(null);

    const cambiar = (i: number, estado: EstadoArchivo) =>
      setEstados((prev) => (prev ? prev.map((e, j) => (j === i ? estado : e)) : prev));

    const cola = analisis.archivos.map((a, i) => i).filter((i) => !analisis.archivos[i].error);
    const trabajador = async () => {
      for (let i = cola.shift(); i !== undefined; i = cola.shift()) {
        cambiar(i, { fase: "procesando" });
        try {
          const form = new FormData();
          form.set("anioMes", mes);
          form.set("archivo", ficheros[i]);
          if (analisis.dueno) form.set("dueno", analisis.dueno);
          const r = await fetch("/api/importar/procesar", { method: "POST", body: form });
          if (r.status === 401) return void (window.location.href = "/login?volver=/importar");
          const datos = await r.json();
          cambiar(i, r.ok ? { fase: "ok", resultado: datos } : { fase: "error", mensaje: datos.error ?? "Error al procesar." });
        } catch {
          cambiar(i, { fase: "error", mensaje: "No se pudo conectar con el servidor." });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
    setTrabajando(false);
  }

  const necesitaDueno = analisis && !analisis.duenoConfirmado;
  const procesables = analisis ? analisis.archivos.filter((a) => !a.error).length : 0;
  const terminado = estados !== null && estados.every((e) => e.fase === "ok" || e.fase === "error" || e.fase === "pendiente") && !trabajando;
  const hayOk = estados?.some((e) => e.fase === "ok");

  return (
    <div className="space-y-4">
      {/* 1. Mes y archivos */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium">
          Mes a liquidar
          <input
            type="month"
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              reiniciarAnalisis();
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base"
          />
        </label>

        <div>
          <input
            ref={entrada}
            type="file"
            multiple
            accept=".txt,.zip,text/plain,application/zip"
            className="hidden"
            onChange={(e) => {
              setFicheros(Array.from(e.target.files ?? []));
              reiniciarAnalisis();
            }}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center text-sm hover:border-gray-500"
          >
            {ficheros.length === 0 ? "Elegir archivos (.txt o .zip)" : `${ficheros.length} archivo${ficheros.length === 1 ? "" : "s"} elegido${ficheros.length === 1 ? "" : "s"} · cambiar`}
          </button>
          {ficheros.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
              {ficheros.map((f, i) => (
                <li key={i} className="truncate">📄 {f.name}</li>
              ))}
            </ul>
          )}
        </div>

        {!analisis && (
          <button
            type="button"
            disabled={ficheros.length === 0 || !mes || trabajando}
            onClick={() => analizar()}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {trabajando ? "Leyendo…" : "Continuar"}
          </button>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {/* 2. Confirmar quién es el dueño (la primera vez) */}
      {analisis && necesitaDueno && (
        <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            {analisis.dueno ? `Parece que tú eres «${analisis.dueno}» en estos chats.` : "¿Quién eres tú en estos chats?"} Confírmalo para
            identificar a cada repartidor (solo te lo preguntamos esta vez).
          </p>
          <select
            value={duenoSel}
            onChange={(e) => setDuenoSel(e.target.value)}
            className="block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-base"
          >
            {analisis.candidatosDueno.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!duenoSel || trabajando}
            onClick={() => analizar(duenoSel, true)}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Sí, soy yo
          </button>
        </section>
      )}

      {/* 3. Qué se ha encontrado */}
      {analisis && !necesitaDueno && (
        <section className="space-y-3">
          {analisis.mesCerrado && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {etiquetaMes(mes)} está cerrado. Reábrelo para poder importar.
            </p>
          )}
          <ul className="space-y-2">
            {analisis.archivos.map((a, i) => {
              const est = estados?.[i];
              return (
                <li key={i} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.error ? a.nombre : a.nombreDetectado ?? a.nombre}</p>
                      <p className="truncate text-xs text-gray-500">{a.nombre}</p>
                    </div>
                    <EstadoChip a={a} est={est} />
                  </div>
                  {a.error ? (
                    <p className="mt-1 text-red-700">{a.error}</p>
                  ) : est?.fase === "ok" ? (
                    <p className="mt-1 text-gray-700">
                      <strong>{est.resultado.entregados}</strong> entregados en {est.resultado.dias} días
                      {est.resultado.dudosos > 0 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          {est.resultado.dudosos} por revisar
                        </span>
                      )}
                      {est.resultado.errores > 0 && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">{est.resultado.errores} con error</span>
                      )}
                    </p>
                  ) : est?.fase === "error" ? (
                    <p className="mt-1 text-red-700">{est.mensaje}</p>
                  ) : (
                    <>
                      <p className="mt-1 text-gray-600">
                        {a.mensajesEnMes} mensaje{a.mensajesEnMes === 1 ? "" : "s"} en {etiquetaMes(mes)} ·{" "}
                        {a.repartidorId ? "repartidor ya dado de alta" : "repartidor nuevo"}
                      </p>
                      {a.mensajesEnMes === 0 && (
                        <p className="mt-1 text-amber-800">No hay mensajes suyos en este mes: ¿es el mes correcto?</p>
                      )}
                      {a.existentes && (
                        <p className="mt-1 text-amber-800">
                          Ya hay {a.existentes.registros} días guardados este mes
                          {a.existentes.editados > 0 ? ` (${a.existentes.editados} editados a mano)` : ""}: se reemplazarán.
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {!terminado && !estados && (
            <button
              type="button"
              disabled={procesables === 0 || trabajando || analisis.mesCerrado}
              onClick={procesar}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Procesar {procesables} chat{procesables === 1 ? "" : "s"}
            </button>
          )}
          {trabajando && estados && (
            <p className="text-center text-sm text-gray-600">Procesando… la IA tarda unos segundos por chat.</p>
          )}
          {terminado && hayOk && (
            <Link href={`/meses/${mes}`} className="block rounded-lg bg-green-700 px-4 py-3 text-center text-sm font-medium text-white">
              Ver y revisar {etiquetaMes(mes)}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function EstadoChip({ a, est }: { a: Analisis["archivos"][number]; est?: EstadoArchivo }) {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium";
  if (a.error) return <span className={`${base} bg-red-100 text-red-800`}>Error</span>;
  if (!est) return <span className={`${base} bg-gray-100 text-gray-700`}>Listo</span>;
  if (est.fase === "procesando") return <span className={`${base} animate-pulse bg-blue-100 text-blue-800`}>Procesando…</span>;
  if (est.fase === "ok") return <span className={`${base} bg-green-100 text-green-800`}>Hecho</span>;
  if (est.fase === "error") return <span className={`${base} bg-red-100 text-red-800`}>Error</span>;
  return <span className={`${base} bg-gray-100 text-gray-700`}>En cola</span>;
}
