"use client";

import { useActionState } from "react";
import type { EstadoLogin } from "@/app/login/actions";

export function FormLogin({
  accion,
  volver,
}: {
  accion: (estado: EstadoLogin, form: FormData) => Promise<EstadoLogin>;
  volver: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const campo = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base";

  return (
    <form action={enviar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="volver" value={volver} />
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" autoCapitalize="none" className={campo} />
      </label>
      <label className="block text-sm font-medium">
        Contraseña
        <input name="contrasena" type="password" required autoComplete="current-password" className={campo} />
      </label>
      {estado?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{estado.error}</p>}
      <button type="submit" disabled={pendiente} className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
