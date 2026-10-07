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

/** Sonnet 5.5: en un chat real superó a Haiku 4.5 y 5.5 (ver Decisiones en SPEC.md). Se puede cambiar con ANTHROPIC_MODEL. */
export const MODELO_POR_DEFECTO = "claude-sonnet-5-5";

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

/** Fable 5.x, Opus 5.5 y Sonnet 5.5 rechazan forzar la herramienta (400): con ellos se usa "auto" y el prompt la pide. */
export function admiteHerramientaForzada(modelo: string): boolean {
  return !/fable|mythos|opus-5-5|sonnet-5-5/.test(modelo);
}

/** Texto real de los mensajes citados por la IA (números desde 1), con su fecha y hora. */
export function textoOriginal(mensajes: Mensaje[], numeros: number[]): string {
  return [...new Set(numeros)]
    .sort((a, b) => a - b)
    .map((n) => mensajes[n - 1])
    .filter((m): m is Mensaje => !!m)
    .map((m) => `${m.fechaHora.slice(8, 10)}/${m.fechaHora.slice(5, 7)} ${m.fechaHora.slice(11, 16)} · ${m.texto}`)
    .join("\n");
}

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
      tool_choice: admiteHerramientaForzada(modelo) ? { type: "tool", name: NOMBRE_HERRAMIENTA } : { type: "auto" },
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
      const todos = analisis.data.registros.map(({ mensajes: numeros, ...r }): RegistroIA => ({
        ...r,
        mensaje_original: textoOriginal(mensajes, numeros),
      }));
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
