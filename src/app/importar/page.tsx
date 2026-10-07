import { ImportarChats } from "@/components/ImportarChats";
import { mesActual } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export default async function PaginaImportar({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Subir chats</h1>
        <p className="mt-1 text-sm text-gray-600">
          En WhatsApp: abre el chat del repartidor → ⋮ Más → <strong>Exportar chat</strong> → <strong>Sin archivos</strong>. Repite con
          cada repartidor y súbelos todos a la vez (.txt o .zip).
        </p>
      </div>
      <ImportarChats mesInicial={mes && /^\d{4}-\d{2}$/.test(mes) ? mes : mesActual()} />
    </div>
  );
}
