import JSZip from "jszip";

export interface ArchivoChat {
  /** Nombre del archivo subido (sirve para identificar al repartidor). */
  nombre: string;
  texto: string;
}

function decodificar(datos: Uint8Array): string {
  return new TextDecoder("utf-8").decode(datos).replace(/^﻿/, "");
}

/** Lee un `.txt` o un `.zip` (con `_chat.txt` dentro) exportado de WhatsApp. */
export async function leerArchivoChat(nombre: string, datos: Uint8Array): Promise<ArchivoChat> {
  const esZip =
    /\.zip$/i.test(nombre) || (datos.length > 3 && datos[0] === 0x50 && datos[1] === 0x4b);
  if (!esZip) return { nombre, texto: decodificar(datos) };

  const zip = await JSZip.loadAsync(datos);
  const entradas = Object.values(zip.files).filter(
    (f) => !f.dir && !f.name.startsWith("__MACOSX/") && /\.txt$/i.test(f.name),
  );
  const entrada = entradas.find((f) => /(^|\/)_chat\.txt$/i.test(f.name)) ?? entradas[0];
  if (!entrada) throw new Error(`El zip "${nombre}" no contiene un chat (_chat.txt).`);
  return { nombre, texto: decodificar(await entrada.async("uint8array")) };
}

const PATRONES_NOMBRE = [
  /^chat de whatsapp con\s+(.+)$/i,
  /^whatsapp chat with\s+(.+)$/i,
  /^(?:chat de )?whatsapp(?: chat)?\s*-\s*(.+)$/i,
];

/** Extrae el nombre del contacto de "Chat de WhatsApp con Juan.txt" y variantes. */
export function nombreDesdeArchivo(nombreArchivo: string): string | null {
  const base = nombreArchivo.split(/[\\/]/).pop() ?? nombreArchivo;
  const sinExt = base
    .replace(/\.(txt|zip)$/i, "")
    .replace(/_/g, " ") // al descargar, los espacios pueden pasar a guiones bajos
    .replace(/\s*\(\d+\)$/, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const re of PATRONES_NOMBRE) {
    const m = sinExt.match(re);
    if (m) return m[1].trim();
  }
  if (!sinExt || /^_?chat$/i.test(sinExt)) return null;
  return sinExt;
}
