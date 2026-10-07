import { z } from "zod";

/** Un dato diario tal como lo devuelve la IA. La IA NO calcula totales ni entregados. */
export const RegistroBrutoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe ser AAAA-MM-DD"),
  salida: z.number().int().nonnegative().nullable(),
  vuelta: z.number().int().nonnegative().nullable(),
  /** Entregados tal como los dice el repartidor ("entreg 19"). El código deduce la vuelta con él. */
  entregados: z.number().int().nonnegative().nullable().default(null),
  confianza: z.enum(["alta", "baja"]),
  nota: z.string().nullable(),
  /** Números (#n, desde 1) de los mensajes enviados de los que sale el dato. */
  mensajes: z.array(z.number().int().positive()),
});

export const RespuestaIASchema = z.object({
  registros: z.array(RegistroBrutoSchema),
});

export type RegistroBruto = z.infer<typeof RegistroBrutoSchema>;

/** Registro ya procesado: el texto original lo pone el código a partir de los números de mensaje. */
export type RegistroIA = Omit<RegistroBruto, "mensajes"> & { mensaje_original: string };

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
            entregados: {
              anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
              description:
                "Paquetes entregados SOLO si el repartidor lo dice expresamente (\"entreg 19\", \"11 de 13\"); null si no.",
            },
            confianza: { type: "string", enum: ["alta", "baja"] },
            nota: {
              anyOf: [{ type: "string" }, { type: "null" }],
              description: "Explicación breve si hubo corrección, deducción o ambigüedad.",
            },
            mensajes: {
              type: "array",
              items: { type: "integer", minimum: 1 },
              description: "Números (#n) de los mensajes de los que sale el dato.",
            },
          },
          required: ["fecha", "salida", "vuelta", "entregados", "confianza", "nota", "mensajes"],
          additionalProperties: false,
        },
      },
    },
    required: ["registros"],
    additionalProperties: false,
  },
};

export const INSTRUCCIONES_SISTEMA = `Eres un asistente que extrae datos de reparto de mensajes de WhatsApp.
Recibirás los mensajes de UN repartidor durante un mes, con fecha y hora, cada uno numerado con el formato "#n [AAAA-MM-DD día hora] texto".
Cada día el repartidor indica con cuántos paquetes salió y con cuántos volvió, o cuántos entregó. Lo único que importa son los paquetes ENTREGADOS cada día; salida y vuelta son datos secundarios.
Devuelve el resultado llamando a la herramienta "${NOMBRE_HERRAMIENTA}".

Para cada día con datos devuelve UN registro con:
fecha (AAAA-MM-DD), salida, vuelta, entregados, confianza ("alta" | "baja"), nota, mensajes.
- salida: paquetes con los que salió.
- vuelta: paquetes con los que volvió (no entregados).
- entregados: paquetes entregados, solo si el repartidor lo dice expresamente.
- mensajes: los números (#n) de los mensajes de los que sale el dato (no copies su texto).

Vocabulario habitual:
- "paq", "paquetes", "salida 17", "salí con 120" = salida.
- "entreg", "entregado(s)" = entregados. "27 paq entreg" = 27 entregados.
- "inc", "incidencia(s)" = paquetes que no se pudieron entregar: no nos interesan, no las registres como dato; sirven solo de contexto (no las uses para inventar una salida ni unos entregados).
- "11 de 13" o "entregado 3 de 3" = entregó 11 de 13 (entregados 11, salida 13).
- "entreg todos" / "entregados todos" = entregó todos: vuelta 0.

Reglas:
- Si el mensaje incluye una fecha ("17/7", "01/08", "11 de agosto"), esa es la fecha del reparto, aunque el mensaje se enviara otro día. Sin año, usa el del mes procesado. Sin fecha en el texto, usa la del mensaje.
- Un mismo día suele repartirse en varios mensajes (salida por la mañana, entregados por la noche): combínalos en un único registro.
- Si hay una corrección el mismo día ("perdona, eran 118"), usa el último dato y explícalo en "nota".
- Si un mensaje enviado de madrugada (00:00–05:59) se refiere claramente al día anterior, asígnalo a ese día.
- Si falta algún dato (por ejemplo hay salida pero ni vuelta ni entregados), pon null. No inventes cifras.
- "confianza" es "baja" solo si el dato es realmente dudoso: cifras contradictorias, recuerdos aproximados ("como 10 u 11") o información que falta. Es "alta" si el repartidor lo dice claro, aunque mencione incidencias sin cifra o haya corregido un dato.
- "nota": null salvo que haga falta aclarar algo; entonces una sola frase corta (máximo 15 palabras).
- Si el mismo día hay dos datos distintos y no puedes saber cuál es el válido, devuelve ambos como registros separados de esa fecha, con confianza "baja".
- Ignora mensajes que no hablen de paquetes (llamadas, fotos, direcciones, códigos, conversación).
- NO calcules totales ni hagas restas: no deduzcas la vuelta a partir de los entregados; copia lo que dice cada mensaje y el código hará las cuentas.`;
