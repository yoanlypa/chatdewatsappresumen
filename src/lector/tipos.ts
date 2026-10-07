/** Mensaje de WhatsApp ya interpretado. `fechaHora` es hora local "naive": AAAA-MM-DDTHH:mm:ss. */
export interface Mensaje {
  fechaHora: string;
  remitente: string;
  texto: string;
}

export interface OpcionesParser {
  /** Orden de la fecha en el export. Por defecto español: día/mes. */
  orden?: "DMY" | "MDY";
}
