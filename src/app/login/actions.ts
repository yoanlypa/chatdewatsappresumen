"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { abrirSesion, cerrarSesionCookie } from "@/lib/auth";
import { destinoSeguro } from "@/lib/destino";
import { limiteLogin } from "@/lib/limite";
import { prisma } from "@/lib/prisma";
import { normalizarEmail, verificarCredenciales } from "@/lib/usuarios";

export type EstadoLogin = { error?: string } | undefined;

export async function iniciarSesionAction(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = normalizarEmail(String(form.get("email") ?? ""));
  const contrasena = String(form.get("contrasena") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const claves = [`email:${email}`, `ip:${ip}`];

  const espera = Math.max(...claves.map((c) => limiteLogin.bloqueadoSegundos(c)));
  if (espera > 0) return { error: `Demasiados intentos. Espera ${Math.ceil(espera / 60)} min e inténtalo de nuevo.` };

  const usuario = email && contrasena ? await verificarCredenciales(prisma, email, contrasena) : null;
  if (!usuario) {
    claves.forEach((c) => limiteLogin.registrarFallo(c));
    return { error: "Email o contraseña incorrectos." };
  }
  limiteLogin.limpiar(`email:${email}`);
  await abrirSesion(usuario);
  redirect(destinoSeguro(String(form.get("volver") ?? "")));
}

export async function cerrarSesionAction() {
  await cerrarSesionCookie();
  redirect("/login");
}
