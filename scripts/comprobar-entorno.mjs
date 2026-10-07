// Se ejecuta antes de arrancar en producción: avisa en claro de qué variables faltan.
const problemas = [];
if (!process.env.DATABASE_URL) {
  problemas.push(
    "DATABASE_URL está vacía. En Railway: servicio de la app → Variables → Add Reference Variable → Postgres → DATABASE_URL, y pulsa Deploy.",
  );
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  problemas.push("SESSION_SECRET falta o es demasiado corta (mínimo 32 caracteres). Mira DESPLIEGUE.md.");
}
if (!process.env.ANTHROPIC_API_KEY) {
  problemas.push("ANTHROPIC_API_KEY falta: la app arrancará, pero no podrá procesar chats.");
}
const graves = problemas.filter((p) => !p.startsWith("ANTHROPIC_API_KEY"));
for (const p of problemas) console.error(`${graves.includes(p) ? "✖" : "⚠"} ${p}`);
if (graves.length) {
  console.error("\nNo se puede arrancar hasta corregirlo (ver DESPLIEGUE.md).");
  process.exit(1);
}
