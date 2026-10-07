"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesionAction } from "@/app/login/actions";

const ENLACES = [
  { href: "/meses", etiqueta: "Meses", icono: "📅" },
  { href: "/importar", etiqueta: "Subir chats", icono: "⬆️" },
  { href: "/repartidores", etiqueta: "Repartidores", icono: "🛵" },
  { href: "/ajustes", etiqueta: "Ajustes", icono: "⚙️" },
];

export function Nav() {
  const ruta = usePathname();
  const activo = (href: string) => ruta === href || ruta.startsWith(`${href}/`);
  if (ruta === "/login") return null;

  return (
    <>
      {/* Escritorio: barra superior */}
      <header className="hidden border-b border-gray-200 bg-white md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/meses" className="font-semibold text-gray-900">
            Liquidación de repartidores
          </Link>
          <nav className="flex gap-1">
            {ENLACES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  activo(e.href) ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {e.etiqueta}
              </Link>
            ))}
          </nav>
          <form action={cerrarSesionAction} className="ml-auto">
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Salir</button>
          </form>
        </div>
      </header>

      {/* Móvil: barra inferior, a la altura del pulgar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {ENLACES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              activo(e.href) ? "font-semibold text-gray-900" : "text-gray-500"
            }`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {e.icono}
            </span>
            {e.etiqueta}
          </Link>
        ))}
      </nav>
    </>
  );
}
