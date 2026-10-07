# CLAUDE.md

**Lee SPEC.md antes de empezar cualquier tarea.** Es la fuente de verdad del proyecto.

## Resumen
App web mobile-first para que el dueño de una empresa de reparto suba los chats de WhatsApp exportados de sus repartidores y obtenga la liquidación mensual de cada uno (tabla diaria revisable, Excel y PDF).
Regla clave: el código lee, la IA interpreta (solo extrae salida/vuelta por día), el código suma. Ningún total ni importe lo calcula la IA.

## Stack
Next.js (App Router) + TypeScript, Tailwind, Prisma + PostgreSQL, SDK oficial de Anthropic (`claude-haiku-4-5-20251001`), zod, exceljs, jszip, Vitest. Despliegue en Railway. Repo GitHub: `yoanlypa`.

## Comandos útiles
- `npm run dev` — servidor de desarrollo
- `npm test` — tests (Vitest)
- `npm run typecheck` — comprobación de tipos
- `npm run db:generate` / `npm run db:migrate` — cliente Prisma / aplicar migraciones
- `docker compose up -d` — Postgres local en el puerto 5433 (necesita Docker Desktop arrancado)
- `npm run probar -- chat.txt [--mes AAAA-MM] [--repartidor X] [--sin-ia]` — prueba de extremo a extremo por consola (necesita ANTHROPIC_API_KEY en .env, salvo --sin-ia)

## Estructura
- `src/lector/` — lector de chats (sin IA): parser, zip, identificación de dueño/repartidor
- `tests/` y `tests/fixtures/` — tests Vitest y chats de ejemplo (Android 24 h/12 h, iPhone)
- `src/ia/` — extracción con IA (tool use + zod); `src/validacion/` — estados ok/dudoso/error; `src/calculo/` — entregados y totales (siempre en código)
- `scripts/probar.ts` — script de consola
- `prisma/` — esquema y migraciones (Prisma 7, ver Decisiones en SPEC.md)

## Convenciones
- Interfaz y comunicación en español.
- Trabajo por fases (SPEC.md sección 11): al terminar, tests pasando + commit + resumen corto.
- Decisiones propias → sección "Decisiones" de SPEC.md, con fecha.
- Clave de Anthropic solo en servidor (variable de entorno). Prohibidas librerías no oficiales de WhatsApp.
