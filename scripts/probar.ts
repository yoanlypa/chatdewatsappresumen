/**
 * Prueba de extremo a extremo por consola, sin base de datos:
 *   npm run probar -- chat.txt [--mes 2026-09] [--repartidor "Juan"] [--dueno "Carlos"] [--sin-ia] [--json]
 * Acepta .txt o .zip exportados de WhatsApp.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import {
  filtrarMensajes,
  identificarRepartidor,
  leerArchivoChat,
  nombreDesdeArchivo,
  normalizarNombre,
  parsearChat,
  remitentesDe,
} from "../src/lector";
import { extraerRegistros, MODELO_POR_DEFECTO } from "../src/ia/extraer";
import { formatearMensajes, mensajesParaIA } from "../src/ia/preparar";
import { validarRegistros } from "../src/validacion/validar";
import { calcularTotales, entregados } from "../src/calculo/totales";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    mes: { type: "string" },
    repartidor: { type: "string" },
    dueno: { type: "string" },
    "sin-ia": { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

function salir(mensaje: string): never {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

const ruta = positionals[0];
if (!ruta) salir('Uso: npm run probar -- chat.txt [--mes AAAA-MM] [--repartidor "Nombre"] [--dueno "Nombre"] [--sin-ia] [--json]');

const { nombre, texto } = await leerArchivoChat(basename(ruta), readFileSync(ruta));
const mensajes = parsearChat(texto);
if (mensajes.length === 0) salir("No se encontró ningún mensaje. ¿Es un chat exportado de WhatsApp?");

const remitentes = remitentesDe(mensajes);
const identificado = identificarRepartidor({
  nombreArchivo: values.repartidor ? `Chat de WhatsApp con ${values.repartidor}.txt` : nombre,
  remitentes,
  dueno: values.dueno ?? null,
  repartidores: [],
});
if (!identificado.remitente) {
  salir(
    `No pude saber quién es el repartidor entre: ${remitentes.join(", ")}.\n` +
      `  Indícalo con --repartidor "Nombre" o --dueno "Nombre".`,
  );
}
const repartidor = identificado.remitente;
const dueno = remitentes.find((r) => normalizarNombre(r) !== normalizarNombre(repartidor)) ?? "(desconocido)";

// Mes: el indicado o el más reciente con mensajes del repartidor.
const delRepartidor = mensajes.filter((m) => normalizarNombre(m.remitente) === normalizarNombre(repartidor));
const mes = values.mes ?? delRepartidor.map((m) => m.fechaHora.slice(0, 7)).sort().at(-1)!;
if (!/^\d{4}-\d{2}$/.test(mes)) salir("--mes debe tener formato AAAA-MM (por ejemplo 2026-09).");

const paraIA = mensajesParaIA(mensajes, repartidor, mes);
console.log(`\nArchivo:      ${nombre} (${nombreDesdeArchivo(nombre) ?? "nombre no reconocido"})`);
console.log(`Repartidor:   ${repartidor}   ·   Dueño: ${dueno}`);
console.log(`Mes:          ${mes}   ·   Mensajes del repartidor en el mes: ${filtrarMensajes(mensajes, repartidor, mes).length}`);

if (values["sin-ia"]) {
  console.log(`\n--- Lo que se enviaría a la IA ---\n${formatearMensajes(paraIA, mes)}\n`);
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  salir("Falta ANTHROPIC_API_KEY. Ponla en el archivo .env (o usa --sin-ia para ver los mensajes sin llamar a la IA).");
}

const inicio = Date.now();
const modelo = process.env.ANTHROPIC_MODEL ?? MODELO_POR_DEFECTO;
console.log(`Modelo:       ${modelo}\n`);
const extraccion = await extraerRegistros(paraIA, mes);
const { registros, avisos } = validarRegistros(extraccion.registros, { anioMes: mes });
const totales = calcularTotales(registros);

if (values.json) {
  console.log(JSON.stringify({ repartidor, mes, registros, avisos, totales, uso: extraccion.uso }, null, 2));
  process.exit(0);
}

const marca = { ok: "  ", dudoso: "⚠ ", error: "✖ " } as const;
console.log("Fecha        Salida Vuelta Entreg.  Estado");
console.log("-----------  ------ ------ ------  ------------------------------------------");
for (const r of registros) {
  const e = entregados(r);
  const num = (n: number | null) => (n === null ? "—" : String(n)).padStart(6);
  console.log(
    `${r.fecha}  ${num(r.salida)} ${num(r.vuelta)} ${num(e)}  ${marca[r.estado]}${r.estado}` +
      (r.motivos.length ? ` — ${r.motivos.join("; ")}` : ""),
  );
  if (r.notaIa) console.log(`             nota IA: ${r.notaIa}`);
}
for (const a of avisos) console.log(`${a.fecha}  (aviso) ${a.mensaje}`);
if (extraccion.descartados.length) {
  console.log(`\n(${extraccion.descartados.length} registro(s) de la IA fuera del mes, descartados)`);
}

const dudosos = registros.filter((r) => r.estado === "dudoso").length;
const errores = registros.filter((r) => r.estado === "error").length;
console.log("\n=== Totales (calculados por el código) ===");
console.log(`Días trabajados: ${totales.diasTrabajados}   ·   Salida: ${totales.totalSalida}   ·   Vuelta: ${totales.totalVuelta}`);
console.log(`Entregados:      ${totales.totalEntregados}`);
console.log(`Dudosos: ${dudosos}   ·   Errores: ${errores}   ·   Días laborables sin datos: ${avisos.length}   ·   Excluidos del total: ${totales.diasExcluidos}`);
console.log(
  `IA: ${extraccion.uso.llamadas} llamada(s), ${extraccion.uso.entrada} tokens de entrada, ${extraccion.uso.salida} de salida, ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`,
);
