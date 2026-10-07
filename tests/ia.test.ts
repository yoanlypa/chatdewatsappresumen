import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { parsearChat } from "@/lector";
import { ErrorExtraccion, admiteHerramientaForzada, extraerRegistros, textoOriginal, type ClienteIA } from "@/ia/extraer";
import { formatearMensajes, mensajesParaIA } from "@/ia/preparar";
import { NOMBRE_HERRAMIENTA } from "@/ia/esquema";
import { validarRegistros } from "@/validacion/validar";
import { calcularTotales } from "@/calculo/totales";

const fixture = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)), "utf8");

/** Respuesta simulada de la API con una llamada a la herramienta. */
function respuestaHerramienta(input: unknown, id = "toolu_1"): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "tool_use", id, name: NOMBRE_HERRAMIENTA, input }],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  } as unknown as Anthropic.Message;
}

const clienteCon = (...respuestas: Anthropic.Message[]) => {
  const create = vi.fn();
  respuestas.forEach((r) => create.mockResolvedValueOnce(r));
  return { cliente: { messages: { create } } as unknown as ClienteIA, create };
};

const r = (fecha: string, salida: number | null, vuelta: number | null) => ({
  entregados: null,
  fecha,
  salida,
  vuelta,
  confianza: "alta" as const,
  nota: null,
  mensajes: [1],
});

describe("mensajesParaIA / formatearMensajes", () => {
  const msgs = [
    { fechaHora: "2026-09-30T21:00:00", remitente: "Juan", texto: "100/5" },
    { fechaHora: "2026-10-01T00:30:00", remitente: "Juan", texto: "ayer 90/4" },
    { fechaHora: "2026-10-01T21:00:00", remitente: "Juan", texto: "95/5" },
    { fechaHora: "2026-09-30T22:00:00", remitente: "Jefe", texto: "ok" },
    { fechaHora: "2026-10-02T09:00:00", remitente: "Juan", texto: "Entreg 30 1/10" },
    { fechaHora: "2026-10-04T09:00:00", remitente: "Juan", texto: "Salida 20 4/10" },
    { fechaHora: "2026-09-15T10:00:00", remitente: "Juan", texto: "Y0321682h" },
    { fechaHora: "2026-09-15T10:01:00", remitente: "Juan", texto: "Salida 20 15/9" },
  ];

  it("envía solo al repartidor, el mes y los 3 primeros días del siguiente, sin mensajes que son solo un código", () => {
    const sel = mensajesParaIA(msgs, "Juan", "2026-09");
    expect(sel.map((m) => m.texto)).toEqual(["100/5", "Salida 20 15/9", "ayer 90/4", "95/5", "Entreg 30 1/10"]);
  });

  it("formatea con fecha, día de la semana y hora, y sangra las líneas siguientes", () => {
    const txt = formatearMensajes(
      [{ fechaHora: "2026-09-08T21:25:00", remitente: "Juan", texto: "hoy duro\nsalí con 140" }],
      "2026-09",
    );
    expect(txt).toContain("Mes a procesar: 2026-09");
    expect(txt).toContain("[2026-09-08 mar 21:25] hoy duro\n    salí con 140");
  });
});

describe("textoOriginal", () => {
  const msgs = [
    { fechaHora: "2026-07-01T11:22:10", remitente: "Y", texto: "39 paq 1/7" },
    { fechaHora: "2026-07-01T18:59:00", remitente: "Y", texto: "34 entreg" },
  ];
  it("pone el texto real de los mensajes citados, sin duplicados y en orden", () => {
    expect(textoOriginal(msgs, [2, 1, 2])).toBe("01/07 11:22 · 39 paq 1/7\n01/07 18:59 · 34 entreg");
  });
  it("ignora números que no existen", () => {
    expect(textoOriginal(msgs, [9, 1])).toBe("01/07 11:22 · 39 paq 1/7");
    expect(textoOriginal(msgs, [])).toBe("");
  });
});

describe("modelos y herramienta forzada", () => {
  it.each([
    ["claude-haiku-4-5", true],
    ["claude-haiku-5-5", true],
    ["claude-sonnet-5-5", false],
    ["claude-opus-5-5", false],
    ["claude-fable-5-1", false],
  ])("%s → herramienta forzada: %s", (modelo, esperado) => {
    expect(admiteHerramientaForzada(modelo)).toBe(esperado);
  });
});

describe("extraerRegistros", () => {
  const msgs = [{ fechaHora: "2026-09-01T21:15:00", remitente: "Juan", texto: "120/8" }];

  it("pide salida estructurada con tool_choice forzado (Haiku) y devuelve los registros validados", async () => {
    const { cliente, create } = clienteCon(respuestaHerramienta({ registros: [r("2026-09-01", 120, 8)] }));
    const res = await extraerRegistros(msgs, "2026-09", { cliente, modelo: "claude-haiku-4-5" });
    const { mensajes: _m, ...esperado } = r("2026-09-01", 120, 8);
    expect(res.registros).toEqual([{ ...esperado, mensaje_original: "01/09 21:15 · 120/8" }]);
    expect(res.uso).toEqual({ entrada: 100, salida: 50, llamadas: 1 });
    const params = create.mock.calls[0][0];
    expect(params.tool_choice).toEqual({ type: "tool", name: NOMBRE_HERRAMIENTA });
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.system).toMatch(/NO calcules totales/);
  });

  it("por defecto usa Sonnet 5.5 con tool_choice auto (no admite forzarla)", async () => {
    const { cliente, create } = clienteCon(respuestaHerramienta({ registros: [] }));
    await extraerRegistros(msgs, "2026-09", { cliente });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.tool_choice).toEqual({ type: "auto" });
  });

  it("descarta registros fuera del mes y los devuelve aparte", async () => {
    const { cliente } = clienteCon(
      respuestaHerramienta({ registros: [r("2026-09-01", 120, 8), r("2026-08-31", 100, 5)] }),
    );
    const res = await extraerRegistros(msgs, "2026-09", { cliente });
    expect(res.registros.map((x) => x.fecha)).toEqual(["2026-09-01"]);
    expect(res.descartados.map((x) => x.fecha)).toEqual(["2026-08-31"]);
  });

  it("reintenta una vez si la respuesta no es válida, devolviendo el error a la IA", async () => {
    const { cliente, create } = clienteCon(
      respuestaHerramienta({ registros: [{ fecha: "1/9", salida: "ciento veinte" }] }),
      respuestaHerramienta({ registros: [r("2026-09-01", 120, 8)] }, "toolu_2"),
    );
    const res = await extraerRegistros(msgs, "2026-09", { cliente });
    expect(res.registros).toHaveLength(1);
    expect(res.uso.llamadas).toBe(2);
    const segunda = create.mock.calls[1][0].messages;
    expect(segunda.at(-1).content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1", is_error: true });
  });

  it("falla si la IA sigue devolviendo datos no válidos", async () => {
    const mala = respuestaHerramienta({ registros: [{ fecha: "x" }] });
    const { cliente, create } = clienteCon(mala, mala);
    await expect(extraerRegistros(msgs, "2026-09", { cliente })).rejects.toBeInstanceOf(ErrorExtraccion);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("falla si la respuesta no trae la herramienta o se corta", async () => {
    const sinHerramienta = { ...respuestaHerramienta({}), content: [{ type: "text", text: "hola" }] } as unknown as Anthropic.Message;
    await expect(extraerRegistros(msgs, "2026-09", { cliente: clienteCon(sinHerramienta).cliente })).rejects.toThrow(/estructurados/);
    const cortada = { ...respuestaHerramienta({}), stop_reason: "max_tokens" } as unknown as Anthropic.Message;
    await expect(extraerRegistros(msgs, "2026-09", { cliente: clienteCon(cortada).cliente })).rejects.toThrow(/max_tokens/);
  });

  it("sin mensajes no llama a la IA", async () => {
    const { cliente, create } = clienteCon();
    const res = await extraerRegistros([], "2026-09", { cliente });
    expect(res.registros).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("flujo completo con el chat de ejemplo (IA simulada)", () => {
  it("los totales coinciden con la suma manual", async () => {
    const mensajes = parsearChat(fixture("android_juan.txt"));
    const paraIA = mensajesParaIA(mensajes, "Juan Pérez", "2026-09");
    expect(paraIA).toHaveLength(13); // 12 del mes + "Salí con 90, volví con 2" del 1/10 (margen)

    // Lo que devolvería una IA correcta para ese chat (corrección del 4, entregados del 5, madrugada del 10).
    const salidaIA = [
      r("2026-09-01", 120, 8),
      r("2026-09-02", 130, 12),
      r("2026-09-03", 95, 3),
      r("2026-09-04", 118, 5),
      r("2026-09-05", 120, 8),
      r("2026-09-07", 100, 4),
      r("2026-09-08", 140, 10),
      r("2026-09-09", 110, 6),
      r("2026-09-11", 125, 9),
    ];
    const { cliente } = clienteCon(respuestaHerramienta({ registros: salidaIA }));
    const extraccion = await extraerRegistros(paraIA, "2026-09", { cliente });
    const { registros, avisos } = validarRegistros(extraccion.registros, { anioMes: "2026-09" });
    const totales = calcularTotales(registros);

    // Suma manual: 112 + 118 + 92 + 113 + 112 + 96 + 130 + 104 + 116
    expect(totales.totalEntregados).toBe(993);
    expect(totales.diasTrabajados).toBe(9);
    expect(totales.totalSalida).toBe(1058);
    expect(totales.totalVuelta).toBe(65);
    expect(registros.every((x) => x.estado === "ok")).toBe(true);
    expect(avisos).toHaveLength(17);
  });
});
