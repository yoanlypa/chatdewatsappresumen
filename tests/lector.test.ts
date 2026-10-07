import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  detectarDueno,
  filtrarMensajes,
  identificarRepartidor,
  leerArchivoChat,
  nombreDesdeArchivo,
  parsearChat,
  remitentesDe,
} from "@/lector";

const fixture = (nombre: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${nombre}`, import.meta.url)), "utf8");

describe("parsearChat · Android 24 h", () => {
  const msgs = parsearChat(fixture("android_juan.txt"));

  it("descarta sistema, multimedia omitida y mensajes eliminados", () => {
    expect(msgs).toHaveLength(15);
    const textos = msgs.map((m) => m.texto).join("\n");
    expect(textos).not.toMatch(/cifrados|Multimedia|eliminó/i);
  });

  it("lee fecha y hora con año de 2 dígitos (DD/MM)", () => {
    expect(msgs[0]).toEqual({
      fechaHora: "2026-09-01T08:05:00",
      remitente: "Carlos Jefe",
      texto: "Buenos días Juan, recuerda pasar por el almacén sur",
    });
    expect(msgs[1].fechaHora).toBe("2026-09-01T21:15:00");
    expect(msgs[1].texto).toBe("Salí con 120, volví con 8");
  });

  it("junta los mensajes multilínea", () => {
    const m = msgs.find((x) => x.fechaHora === "2026-09-08T21:25:00")!;
    expect(m.texto).toBe("Pues hoy ha sido duro:\nsalí con 140\ny volví con 10");
  });

  it("quita la marca de mensaje editado", () => {
    const m = msgs.find((x) => x.fechaHora === "2026-09-11T21:15:00")!;
    expect(m.texto).toBe("Salí con 125, volví con 9");
  });

  it("conserva mensajes de madrugada con su hora real", () => {
    expect(msgs.some((m) => m.fechaHora === "2026-09-10T00:20:00")).toBe(true);
  });
});

describe("parsearChat · Android 12 h y año de 4 dígitos", () => {
  const msgs = parsearChat(fixture("android_ana.txt"));

  it("convierte a/p. m. a 24 h", () => {
    expect(msgs.map((m) => m.fechaHora)).toEqual([
      "2026-10-05T21:15:00",
      "2026-10-05T21:20:00",
      "2026-10-06T00:10:00", // 12:10 a. m.
      "2026-10-06T21:05:00",
      "2026-10-07T12:30:00", // 12:30 p. m.
    ]);
  });
});

describe("parsearChat · iPhone", () => {
  const msgs = parsearChat(fixture("iphone_maria.txt"));

  it("ignora caracteres invisibles, aviso de cifrado, imagen omitida y adjuntos", () => {
    expect(msgs).toHaveLength(7);
    expect(msgs.every((m) => !/[\u200e\u202f]/.test(m.remitente + m.texto))).toBe(true);
    expect(msgs.map((m) => m.texto).join("\n")).not.toMatch(/cifrados|omitida|adjunto/i);
  });

  it("lee segundos y hora de 12 h con U+202F", () => {
    expect(msgs[0].fechaHora).toBe("2026-09-02T21:15:03");
    const m = msgs.find((x) => x.texto.startsWith("Hoy salí con 105"))!;
    expect(m.fechaHora).toBe("2026-09-04T21:45:00");
  });

  it("junta multilínea con CRLF", () => {
    const m = msgs.find((x) => x.fechaHora === "2026-09-08T21:30:00")!;
    expect(m.texto).toBe("Salí con 110\nno pude contar la vuelta");
  });
});

describe("parsearChat · casos límite", () => {
  it("admite orden MDY si se indica", () => {
    const [m] = parsearChat("12/31/26, 10:00 - A: hola", { orden: "MDY" });
    expect(m.fechaHora).toBe("2026-12-31T10:00:00");
  });

  it("no toma fechas imposibles como cabecera (queda como continuación)", () => {
    const msgs = parsearChat("01/09/26, 10:00 - A: uno\n31/02/26, 10:00 - B: falso");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].texto).toContain("31/02/26");
  });

  it("ignora líneas sueltas antes del primer mensaje", () => {
    expect(parsearChat("basura\n01/09/26, 10:00 - A: hola")).toHaveLength(1);
  });
});

describe("leerArchivoChat", () => {
  it("lee un .txt (quita BOM)", async () => {
    const datos = new TextEncoder().encode("\ufeff01/09/26, 10:00 - A: hola");
    const { texto } = await leerArchivoChat("chat.txt", datos);
    expect(parsearChat(texto)).toHaveLength(1);
  });

  it("extrae _chat.txt de un .zip", async () => {
    const zip = new JSZip();
    zip.file("__MACOSX/._chat.txt", "basura");
    zip.file("_chat.txt", fixture("iphone_maria.txt"));
    const datos = await zip.generateAsync({ type: "uint8array" });
    const { nombre, texto } = await leerArchivoChat("WhatsApp Chat - María Gómez.zip", datos);
    expect(nombre).toBe("WhatsApp Chat - María Gómez.zip");
    expect(parsearChat(texto)).toHaveLength(7);
  });

  it("falla con un zip sin chat", async () => {
    const zip = new JSZip();
    zip.file("foto.jpg", "x");
    const datos = await zip.generateAsync({ type: "uint8array" });
    await expect(leerArchivoChat("x.zip", datos)).rejects.toThrow(/no contiene/);
  });
});

describe("nombreDesdeArchivo", () => {
  it.each([
    ["Chat de WhatsApp con Juan Pérez.txt", "Juan Pérez"],
    ["Chat de WhatsApp con Juan Pérez (2).zip", "Juan Pérez"],
    ["WhatsApp Chat - María Gómez.zip", "María Gómez"],
    ["WhatsApp Chat with Ana.txt", "Ana"],
    ["Pedro.txt", "Pedro"],
    ["C:\\descargas\\Chat de WhatsApp con Luis.txt", "Luis"],
    ["_chat.txt", null],
  ])("%s → %s", (archivo, esperado) => {
    expect(nombreDesdeArchivo(archivo)).toBe(esperado);
  });
});

describe("dueño y repartidor", () => {
  const juan = remitentesDe(parsearChat(fixture("android_juan.txt")));
  const ana = remitentesDe(parsearChat(fixture("android_ana.txt")));
  const maria = remitentesDe(parsearChat(fixture("iphone_maria.txt")));

  it("detecta al dueño como el remitente común a todos los archivos", () => {
    expect(detectarDueno([juan, ana, maria])).toMatchObject({ remitente: "Carlos Jefe", seguro: true });
  });

  it("con un solo chat pide confirmación", () => {
    const r = detectarDueno([juan]);
    expect(r.remitente).toBeNull();
    expect(r.candidatos.sort()).toEqual(["Carlos Jefe", "Juan Pérez"]);
  });

  it("usa el dueño guardado en ajustes aunque haya un solo chat", () => {
    expect(detectarDueno([juan], "carlos jefe").remitente).toBe("Carlos Jefe");
  });

  it("identifica al repartidor por archivo y remitente", () => {
    const r = identificarRepartidor({
      nombreArchivo: "Chat de WhatsApp con Juan Pérez.txt",
      remitentes: juan,
      dueno: "Carlos Jefe",
      repartidores: [],
    });
    expect(r).toEqual({ remitente: "Juan Pérez", nombreDetectado: "Juan Pérez", repartidorId: null });
  });

  it("tolera nombres parciales: Juan encaja con Juan Pérez", () => {
    const r = identificarRepartidor({
      nombreArchivo: "Chat de WhatsApp con Juan.txt",
      remitentes: juan,
      dueno: null,
      repartidores: [],
    });
    expect(r.remitente).toBe("Juan Pérez");
  });

  it("empareja con un repartidor existente por alias", () => {
    const r = identificarRepartidor({
      nombreArchivo: "Chat de WhatsApp con Juanito moto.txt",
      remitentes: juan,
      dueno: "Carlos Jefe",
      repartidores: [
        { id: 1, nombre: "Ana", aliasWhatsapp: [] },
        { id: 7, nombre: "Juan", aliasWhatsapp: ["Juanito Moto", "Juan Pérez"] },
      ],
    });
    expect(r.repartidorId).toBe(7);
  });

  it("filtra por repartidor y mes", () => {
    const todos = parsearChat(fixture("android_juan.txt"));
    const sep = filtrarMensajes(todos, "juan perez", "2026-09");
    expect(sep).toHaveLength(12); // sin los de Carlos ni el de octubre
    expect(sep.every((m) => m.remitente === "Juan Pérez" && m.fechaHora.startsWith("2026-09"))).toBe(true);
    expect(filtrarMensajes(todos, "Juan Pérez", "2026-10")).toHaveLength(1);
  });
});
