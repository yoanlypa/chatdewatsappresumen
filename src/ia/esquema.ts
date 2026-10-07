import { z } from "zod";

/** Un dato diario tal como lo devuelve la IA. La IA NO calcula totales ni entregados. */
export const RegistroIASchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe ser AAAA-MM-DD"),
  salida: z.number().int().nonnegative().nullable(),
  vuelta: z.number().int().nonnegative().nullable(),
  confianza: z.enum(["alta", "baja"]),
  nota: z.string().nullable(),
  mensaje_original: z.string(),
});

export const RespuestaIASchema = z.object({
  registros: z.array(RegistroIASchema),
});

export type RegistroIA = z.infer<typeof RegistroIASchema>;
export type RespuestaIA = z.infer<typeof RespuestaIASchema>;

export const NOMBRE_HERRAMIENTA = "registrar_dias";

/** JSON schema de la herramienta (salida estructurada vía tool use). */
export const HERRAMIENTA_REGISTRAR_DIAS = {
  name: NOMBRE_HERRAMIENTA,
  description:
    "Registra los datos de reparto (paquetes de salida y de vuelta) extraídos de los mensajes, uno por día con datos.",
  input_schema: {
    type: "object" as const,
    properties: {
      registros: {
        type: "array",
        description: "Un elemento por día con datos. Vacío si no hay ningún dato de reparto.",
        items: {
          type: "object",
          properties: {
            fecha: { type: "string", description: "Fecha del reparto, formato AAAA-MM-DD." },
            salida: {
              anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
              description: "Paquetes con los que salió, o null si no consta.",
            },
            vuelta: {
              anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
              description: "Paquetes con los que volvió, o null si no consta.",
            },
            confianza: { type: "string", enum: ["alta", "baja"] },
            nota: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "Explicación breve si hubo corrección, deducción o ambigüedad.",
            },
            mensaje_original: {
              type: "string",
              description: "Texto del/los mensaje(s) del que sale el dato, tal cual.",
            },
          },
          required: ["fecha", "salida", "vuelta", "confianza", "nota", "mensaje_original"],
          additionalProperties: false,
        },
      },
    },
    required: ["registros"],
    additionalProperties: false,
  },
};

export const INSTRUCCIONES_SISTEMA = `Eres un asistente que extrae datos de reparto de mensajes de WhatsApp.
Recibirás los mensajes de UN repartidor durante un mes, con fecha y hora.
Cada día el repartidor indica con cuántos paquetes salió y con cuántos volvió.
Devuelve el resultado llamando a la herramienta "${NOMBRE_HERRAMIENTA}".

Para cada día con datos devuelve:
fecha (AAAA-MM-DD), salida, vuelta, confianza ("alta" | "baja"), nota, mensaje_original.

Reglas:
- Si hay una corrección el mismo día ("perdona, eran 118"), usa el último dato y explícalo en "nota".
- Si un mensaje enviado de madrugada (00:00–05:59) se refiere claramente al día anterior, asígnalo a ese día.
- Si falta salida o vuelta, pon null y confianza "baja".
- Si el repartidor indica entregados en vez de vuelta ("entregué 112 de 120"), deduce vuelta y explícalo en "nota".
- Si el mismo día hay dos datos distintos y no puedes saber cuál es el válido, devuelve ambos como registros separados de esa fecha, con confianza "baja".
- Ignora mensajes que no hablen de paquetes.
- NO calcules totales.`;
