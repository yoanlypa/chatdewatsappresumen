const INVISIBLES = /[‎‏‪-‮⁦-⁩﻿]/g;
const ESPACIOS_RAROS = /[   ]/g;

/** Quita caracteres invisibles (U+200E, etc.) y unifica espacios raros (U+202F delante de "p. m."). */
export function limpiarLinea(linea: string): string {
  return linea.replace(INVISIBLES, "").replace(ESPACIOS_RAROS, " ").replace(/\r$/, "");
}

/** Minúsculas, sin acentos ni signos, espacios colapsados. Para comparar nombres. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
