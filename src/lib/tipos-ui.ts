/** Tipos de datos que viajan del servidor a los componentes de cliente (solo datos simples). */
import type { TipoTarifa } from "../calculo/pago";
import type { EstadoRegistro } from "../validacion/validar";

export interface RegistroUI {
  id: number;
  fecha: string;
  salida: number | null;
  vuelta: number | null;
  entregados: number | null;
  estado: EstadoRegistro;
  motivos: string[];
  notaIa: string | null;
  mensajeOriginal: string | null;
  editadoManual: boolean;
  revisado: boolean;
}

/** Un día del mes: con registro o, si es laborable y no hay datos, vacío (se pinta en gris). */
export interface FilaDia {
  fecha: string;
  registro: RegistroUI | null;
}

export interface TarifaUI {
  tipo: TipoTarifa;
  tarifaPaquete: number;
  tarifaDia: number;
  tarifaFija: number;
}

export interface DetalleRepartidorMes {
  repartidor: { id: number; nombre: string; tarifa: TarifaUI };
  anioMes: string;
  mesCerrado: boolean;
  filas: FilaDia[];
  /** Suma de los ajustes del mes de este repartidor (€). */
  ajustes: number;
}
