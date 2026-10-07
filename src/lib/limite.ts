/**
 * Límite de intentos de login fallidos, en memoria (suficiente con un solo servidor).
 * Tras MAX_FALLOS fallos seguidos, la clave queda bloqueada VENTANA_MS.
 */
export const MAX_FALLOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;

interface Registro {
  fallos: number;
  desde: number;
}

export class LimiteIntentos {
  private registros = new Map<string, Registro>();

  constructor(private ahora: () => number = Date.now) {}

  /** Segundos que faltan para poder reintentar; 0 si no está bloqueada. */
  bloqueadoSegundos(clave: string): number {
    const r = this.registros.get(clave);
    if (!r) return 0;
    const restante = r.desde + VENTANA_MS - this.ahora();
    if (restante <= 0) {
      this.registros.delete(clave);
      return 0;
    }
    return r.fallos >= MAX_FALLOS ? Math.ceil(restante / 1000) : 0;
  }

  registrarFallo(clave: string): void {
    const r = this.registros.get(clave);
    if (!r || r.desde + VENTANA_MS <= this.ahora()) {
      this.registros.set(clave, { fallos: 1, desde: this.ahora() });
    } else {
      r.fallos++;
    }
    if (this.registros.size > 5000) this.registros.clear(); // evita crecer sin límite
  }

  limpiar(clave: string): void {
    this.registros.delete(clave);
  }
}

export const limiteLogin = new LimiteIntentos();
