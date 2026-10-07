import Anthropic from "@anthropic-ai/sdk";
import type { Mensaje } from "../lector/tipos";
import {
  HERRAMIENTA_REGISTRAR_DIAS,
  INSTRUCCIONES_SISTEMA,
  NOMBRE_HERRAMIENTA,
  RespuestaIASchema,
  type RegistroIA,
} from "./esquema";
import { formatearMensajes } from "./preparar";

/** Haiku 4.5 (alias de claude-haiku-4-5-20251001). Se puede cambiar con ANTHROPIC_MODEL. */
export const MODELO_POR_DEFECTO = "claude-haiku-4-5";

/** Parte mínima del cliente de Anthropic que usamos (facilita los tests). */
export interface ClienteIA {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface OpcionesExtraccion {
  cliente?: ClienteIA;
  modelo?: string;
}

export interface ResultadoExtraccion {
  /** Registros de la IA ya limitados al mes pedido. */
  registros: RegistroIA[];
  /** Registros descartados por caer fuera del mes. */
  descartados: RegistroIA[];
  uso: { entrada: number; salida: number; llamadas: number };
}

export class ErrorExtraccion extends Error {}

/** Una llamada por repartidor y mes. Sale con tool use, se valida con zod y se reintenta una vez. */
export async function extraerRegistros(
  mensajes: Mensaje[],
  anioMes: string,
  opciones: OpcionesExtraccion = {},
): Promise<ResultadoExtraccion> {
  const uso = { entrada: 0, salida: 0, llamadas: 0 };
  if (mensajes.length === 0) return { registros: [], descartados: [], uso };

  const cliente: ClienteIA = opciones.cliente ?? new Anthropic();
  const modelo = opciones.modelo ?? process.env.ANTHROPIC_MODEL ?? MODELO_POR_DEFECTO;

  const conversacion: Anthropic.MessageParam[] = [
    { role: "user", content: formatearMensajes(mensajes, anioMes) },
  ];

  let ultimoError = "";
  for (let intento = 0; intento < 2; intento++) {
    const respuesta = await cliente.messages.create({
      model: modelo,
      max_tokens: 16000,
      system: INSTRUCCIONES_SISTEMA,
      tools: [HERRAMIENTA_REGISTRAR_DIAS],
      tool_choice: { type: "tool", name: NOMBRE_HERRAMIENTA },
      messages: conversacion,
    });
    uso.llamadas++;
    uso.entrada += respuesta.usage.input_tokens;
    uso.salida += respuesta.usage.output_tokens;

    if (respuesta.stop_reason === "max_tokens") {
      throw new ErrorExtraccion("La respuesta de la IA se cortó (max_tokens).");
    }

    const bloque = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === NOMBRE_HERRAMIENTA,
    );
    if (!bloque) {
      throw new ErrorExtraccion("La IA no devolvió datos estructurados.");
    }

    const analisis = RespuestaIASchema.safeParse(bloque.input);
    if (analisis.success) {
      const todos = analisis.data.registros;
      const registros = todos.filter((r) => r.fecha.startsWith(anioMes));
      return { registros, descartados: todos.filter((r) => !r.fecha.startsWith(anioMes)), uso };
    }

    ultimoError = analisis.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    conversacion.push(
      { role: "assistant", content: respuesta.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: bloque.id,
            is_error: true,
            content: `La respuesta no es válida: ${ultimoError}. Vuelve a llamar a la herramienta corrigiéndola.`,
          },
        ],
      },
    );
  }
  throw new ErrorExtraccion(`La IA devolvió datos no válidos dos veces: ${ultimoError}`);
}
