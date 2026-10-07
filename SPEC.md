Proyecto: App de liquidación de repartidores a partir de chats de WhatsApp
0. Cómo quiero que trabajes

1. Lee este documento entero antes de escribir código.
2. Guárdalo tal cual como `SPEC.md` en la raíz del proyecto. Será la fuente de verdad del proyecto en todas las sesiones.
3. Crea un `CLAUDE.md` breve con: resumen del proyecto, stack, comandos útiles y la indicación "Lee SPEC.md antes de empezar cualquier tarea".
4. Propón un plan por fases (ver sección 11) y espera mi OK antes de empezar a programar.
5. Trabaja fase a fase. Al terminar cada una: tests pasando, commit con mensaje claro y un resumen corto de qué está hecho y qué falta.
6. Si algo no está definido aquí, elige la opción más razonable, apúntala en una sección "Decisiones" al final de `SPEC.md` y avísame. Pregunta solo si te bloquea.
7. Antes de usar la API de Anthropic o cualquier librería, consulta su documentación actual; no te fíes de memoria.
8. Interfaz y comunicación conmigo: en español.
9. Repositorio en GitHub (usuario `yoanlypa`). Despliegue en Railway.

1. Contexto del negocio
Estoy desarrollando esta app para vendérsela a un cliente que tiene una empresa de reparto de paquetes.

* Cada día, al terminar, cada repartidor le envía al dueño un WhatsApp con cuántos paquetes llevó al salir y con cuántos volvió.
* A fin de mes, el dueño tiene que recorrer el chat de cada repartidor día por día, apuntar los números y calcular lo que le paga a cada uno. Le lleva horas y se cometen errores.
* Objetivo: el dueño exporta los chats de WhatsApp, los sube a la app y la app, con ayuda de IA, le genera los totales y la liquidación de cada repartidor.
* Importante: los repartidores no cambian nada de lo que hacen hoy.

Fórmula base: entregados = salida − vuelta.
2. Flujo del usuario (dueño)

1. En WhatsApp (normalmente desde el móvil): abre el chat de un repartidor → Más → Exportar chat → Sin archivos. Obtiene un `.txt` o un `.zip` con `_chat.txt` dentro. Repite con cada repartidor.
2. En la app: sube todos los archivos a la vez y elige el mes.
3. La app procesa: lector de chats → extracción con IA → validaciones.
4. Pantalla de revisión: ve la tabla de cada repartidor, corrige lo marcado como dudoso y lo marca como revisado.
5. Cierra el mes y descarga un Excel con todos los totales y un PDF de liquidación por repartidor.

La app debe ser mobile-first: lo más probable es que el dueño haga todo desde el móvil.
3. Reglas de arquitectura (no negociables)

* El código lee, la IA interpreta, el código suma. La IA solo extrae salida/vuelta por día. Los totales, entregados e importes siempre los calcula el código.
* A la IA solo se le envían los mensajes del repartidor y del mes elegido, nunca el chat completo.
* No se guarda el archivo de chat original: después de procesarlo se guardan solo los registros diarios y el mensaje original de cada día (para la revisión).
* La clave de la API de Anthropic solo vive en el servidor (variable de entorno). Nunca en el cliente.
* Deja un `empresa_id` en las tablas principales para poder vender la app a más empresas en el futuro, aunque de momento solo haya una.

4. Lector de chats (sin IA)
Debe soportar:

* Android: `07/10/26, 21:15 - Juan: Salí con 120, volví con 8`
* iPhone: `[07/10/26, 21:15:03] Juan: Salí con 120, volví con 8`
* Años de 2 y 4 dígitos, formato 24 h y 12 h (`9:15 p. m.`).
* Caracteres invisibles al inicio de línea (por ejemplo U+200E en iPhone).
* Mensajes multilínea (las líneas que no empiezan por fecha pertenecen al mensaje anterior).
* Mensajes de sistema a ignorar: aviso de cifrado de extremo a extremo, `<Multimedia omitido>`, "Se eliminó este mensaje", marcas de mensaje editado, etc.
* Archivos `.zip` (extraer `_chat.txt`).
* Fechas en formato español DD/MM por defecto.

Identificación de personas:

* En cada chat individual hay dos remitentes: el dueño y el repartidor.
* El remitente que aparece en todos los archivos subidos es el dueño. Detéctalo automáticamente y pídele confirmación la primera vez (guardarlo en ajustes).
* El repartidor se identifica por el nombre del archivo (`Chat de WhatsApp con Juan.txt`) y por el remitente. Cada repartidor tiene una lista de alias para que coincida aunque el contacto cambie de nombre.

Salida del lector: lista de mensajes `{ fecha_hora, remitente, texto }` filtrada por repartidor y mes.
Este módulo tiene que tener tests unitarios con fixtures de ambos formatos.
5. Extracción con IA

* SDK oficial de Anthropic. Modelo: `claude-haiku-4-5-20251001` (barato y suficiente).
* Una llamada por repartidor y mes.
* Usa salida estructurada (tool use con JSON schema) en lugar de pedir "devuelve JSON" en texto libre. Valida la respuesta con `zod` y reintenta una vez si no es válida.
* Envía cada mensaje con su fecha y hora.

Instrucciones para el modelo (adáptalas al formato de tool use):

```
Eres un asistente que extrae datos de reparto de mensajes de WhatsApp.
Recibirás los mensajes de UN repartidor durante un mes, con fecha y hora.
Cada día el repartidor indica con cuántos paquetes salió y con cuántos volvió.

Para cada día con datos devuelve:
fecha (AAAA-MM-DD), salida, vuelta, confianza ("alta" | "baja"), nota, mensaje_original.

Reglas:
- Si hay una corrección el mismo día ("perdona, eran 118"), usa el último dato y explícalo en "nota".
- Si un mensaje enviado de madrugada (00:00–05:59) se refiere claramente al día anterior, asígnalo a ese día.
- Si falta salida o vuelta, pon null y confianza "baja".
- Si el repartidor indica entregados en vez de vuelta ("entregué 112 de 120"), deduce vuelta y explícalo en "nota".
- Ignora mensajes que no hablen de paquetes.
- NO calcules totales.

```

6. Validaciones (código)
Cada registro diario tiene un estado: `ok`, `dudoso` o `error`.

* vuelta > salida → error
* salida o vuelta en null, o confianza baja → dudoso
* dos datos distintos el mismo día que la IA no resolvió → dudoso
* cifra muy fuera de lo normal respecto a la media de ese repartidor → dudoso
* día laborable sin ningún mensaje → aviso (días laborables configurables, por defecto lunes a sábado)

7. Pantalla de revisión

* Resumen del mes: una tarjeta por repartidor con días trabajados, entregados, importe a pagar y número de días dudosos.
* Detalle por repartidor: tabla diaria con fecha | salida | vuelta | entregados | mensaje original | estado.
   * Amarillo = dudoso, rojo = error, gris = día sin datos.
   * Salida y vuelta editables en línea; los cambios manuales quedan marcados.
   * Botón "Marcar como revisado".
   * Los totales se recalculan en tiempo real.
* Tiene que funcionar bien en móvil (en pantallas estrechas, tarjetas en vez de tabla).

8. Cálculo del pago
Tarifa configurable por repartidor, con estos tipos:

* Por paquete entregado (€/paquete)
* Por día trabajado (€/día)
* Fijo mensual + variable por paquete entregado

Además, ajustes manuales por mes (concepto + importe positivo o negativo: adelantos, gasolina, descuentos…).
⚠️ Pendiente de confirmar con el cliente cómo paga en realidad. Deja el sistema flexible.
9. Exportación y cierre de mes

* Excel (`exceljs`): una hoja de resumen con todos los repartidores y una hoja por repartidor con el detalle diario.
* PDF de liquidación por repartidor: datos del mes, tabla diaria, tarifa aplicada, ajustes y total a pagar.
* Cerrar mes: bloquea la edición. Solo se puede reabrir de forma explícita.

10. Stack y modelo de datos
Stack: Next.js (App Router) + TypeScript, Tailwind, Prisma + PostgreSQL (Railway), SDK de Anthropic, `zod`, `exceljs`, `jszip`, generación de PDF (elige la librería más simple que funcione en el servidor) y Vitest para tests.
Autenticación: simple. Login del dueño con email y contraseña (hash con bcrypt) y sesión por cookie. Sin registro público.
Tablas (orientativas):

* `empresas`
* `usuarios` (dueño)
* `repartidores` (nombre, alias_whatsapp[], tipo_tarifa, importes, activo)
* `meses` (empresa, año-mes, estado: abierto/cerrado)
* `registros_dia` (repartidor, fecha, salida, vuelta, estado, nota_ia, mensaje_original, editado_manual, revisado)
* `ajustes` (repartidor, mes, concepto, importe)
* `importaciones` (nombre de archivo, fecha, repartidor detectado, estado, error)

11. Fases

1. Base + lector de chats: proyecto, base de datos y lector con tests usando fixtures inventados de Android e iPhone. Sin IA todavía.
2. IA + validaciones: extracción con IA, validaciones y un script de consola para probar con un `.txt` real (`npm run probar -- chat.txt`).
3. Interfaz: subida de archivos, gestión de repartidores y tarifas, pantalla de revisión.
4. Pago, exportación y cierre: cálculo del pago, Excel, PDF y cierre de mes.
5. Producción: login, despliegue en Railway y datos de demostración para enseñarle la app al cliente.

Futuro (no hacer ahora):

* Compartir el chat directamente desde WhatsApp a la app (PWA con Web Share Target en Android).
* Leer fotos de hojas de ruta (exportar "con archivos" + visión).
* Formulario diario para que los repartidores registren directamente.
* Bot con la API oficial de WhatsApp Business.

Prohibido: librerías no oficiales que se conecten al WhatsApp personal (whatsapp-web.js, Baileys, etc.). Riesgo de baneo del número.
12. Datos de prueba

* Crea fixtures inventados en ambos formatos con las variaciones reales que suelen aparecer:
   * "Salí con 120, volví con 8"
   * "120/8"
   * "hoy 95 y vuelvo con 3"
   * "perdona, eran 118 no 120"
   * "entregué 112 de 120"
   * mensajes de madrugada, días sin reporte, mensajes que no tienen nada que ver con paquetes, multimedia omitido.
* Yo te pasaré un chat real exportado (con los nombres cambiados) para afinar el lector y la IA con el formato real.

13. Criterios de terminado

* Subo 3 chats de ejemplo y en menos de 1 minuto tengo la tabla de cada repartidor.
* Los totales coinciden con una suma manual (cubierto por un test).
* Todo el flujo funciona cómodamente desde el móvil.
* Ningún total ni importe lo calcula la IA.
* Los días dudosos se ven a simple vista.

14. Pendiente de confirmar con el cliente

* Cómo paga a los repartidores (por paquete, por día, fijo + variable) y si la tarifa es igual para todos.
* Cuántos repartidores tiene y si usan Android o iPhone.
* Si alguno reporta con fotos en lugar de texto.
* Si hacen a veces dos rondas en un mismo día.
* Si trabaja como subcontrata (Amazon, GLS, SEUR…). En ese caso, en el futuro se podrían cruzar los datos con las liquidaciones de esa empresa.

Decisiones
(Claude Code: apunta aquí cada decisión que tomes por tu cuenta, con fecha.)

- **2026-10-07 · Prisma 7, no 8.** Prisma 8 está en RC y cambia la API (sin `@prisma/client`, sin `schema.prisma`). Se usa Prisma 7.10 estable (`prisma@prev`), generador `prisma-client` con salida en `src/generated/prisma` y adaptador `@prisma/adapter-pg`.
- **2026-10-07 · Migración inicial generada sin base de datos.** Docker Desktop no estaba arrancado, así que `prisma/migrations/0001_init/migration.sql` se generó con `prisma migrate diff`. Pendiente aplicarla contra un Postgres real (`docker compose up -d` + `npm run db:migrate`).
- **2026-10-07 · `docker-compose.yml`** con Postgres 16 para desarrollo local (usuario/clave/BD `repartidores`).
- **2026-10-07 · `fechaHora` del lector es una cadena local `AAAA-MM-DDTHH:mm:ss`** (sin zona horaria), para evitar desfases y compararla/ordenarla fácilmente.
- **2026-10-07 · Mensajes ignorados por el lector:** sistema (sin remitente), cifrado de extremo a extremo, multimedia/imagen/audio/vídeo/sticker/GIF/documento omitido, adjuntos de iPhone (`<adjunto: …>`), mensajes eliminados y llamadas perdidas. La marca "<Se editó este mensaje>" se elimina pero el mensaje se conserva. También reconoce variantes en inglés.
- **2026-10-07 · Filtro por mes estricto en el lector.** Un mensaje de madrugada del día 1 que se refiera al último día del mes anterior queda fuera del mes elegido. A revisar en la Fase 2 (posible margen de 6 h al enviar a la IA).
- **2026-10-07 · Empresa guarda `remitente_dueno` y `dias_laborables`** (ajustes de empresa; por defecto lunes a sábado).
- **2026-10-07 · Tarifas** en `repartidores`: `tarifa_paquete`, `tarifa_dia`, `tarifa_fija` (según `tipo_tarifa`). `registros_dia` es único por (repartidor, fecha).
- **2026-10-07 · PDF con `pdfkit`** (se instalará en la Fase 4). `zod`, `exceljs` y el SDK de Anthropic se añaden cuando se necesiten.
- **2026-10-07 · Modelo de IA: alias `claude-haiku-4-5`** (mismo modelo que `claude-haiku-4-5-20251001`, sin fijar la fecha de la versión). Configurable con la variable `ANTHROPIC_MODEL`. Nota: existe `claude-haiku-5-5` (más barato por token); se puede probar con `ANTHROPIC_MODEL` para comparar calidad.
- **2026-10-07 · Salida estructurada con tool use** (`registrar_dias`, `tool_choice` forzado, válido en Haiku 4.5). Si la respuesta no pasa zod, se reintenta una vez devolviendo el error a la IA como `tool_result` con `is_error`.
- **2026-10-07 · Instrucciones al modelo:** el prompt del SPEC más una regla: si hay dos datos distintos el mismo día sin poder decidir, devolver ambos registros con confianza baja (así el código puede marcarlo como dudoso, como pide la sección 6).
- **2026-10-07 · Margen de madrugada:** a la IA se envían también los mensajes 00:00–05:59 del día 1 del mes siguiente (pueden referirse al último día del mes). El código descarta cualquier registro con fecha fuera del mes. Resuelve la decisión pendiente de la Fase 1.
- **2026-10-07 · Cifras atípicas: mediana, no media.** Se compara la salida y los entregados de cada día con la mediana de los demás días válidos (mínimo 4 días; desvío > 50 %, configurable). Con la media, un solo valor disparado haría dudosos a todos los demás.
- **2026-10-07 · Aviso de día laborable sin datos** = día laborable sin ningún registro de la IA (no distingue si el repartidor escribió algo que no hablaba de paquetes).
- **2026-10-07 · Totales:** solo entran en el total los días con salida y vuelta presentes y coherentes (vuelta ≤ salida). Los días dudosos con ambos datos sí cuentan (se ven marcados); los incompletos o con error se excluyen y se cuentan aparte (`diasExcluidos`).
- **2026-10-07 · Postgres local en el puerto 5433.** En este PC ya hay un PostgreSQL nativo de Windows en el 5432, así que el de Docker (`docker-compose.yml`) usa el 5433.
- **2026-10-07 · Script `npm run probar`** (`scripts/probar.ts`, sin base de datos): `--mes`, `--repartidor`, `--dueno`, `--sin-ia` (ver lo que se enviaría), `--json`.
- **2026-10-08 · Primer chat real (iPhone, 12 h, ~360 líneas, 3 meses): el formato real es distinto del de los fixtures.** El repartidor escribe "49paq 30/6", "Salida 17 17/7", "34 entreg", "11 de 13", "16 entreg 3 incidencias", "Entreg todos"; la salida suele llegar por la mañana y las entregas por la noche (a veces días después, con fecha explícita), y envía muchas fotos con pie (códigos tipo DNI) que no aportan datos. El prompt y el código se adaptaron a eso (ver siguientes puntos). Los fixtures nuevos (`iphone_estilo_real.txt`) son inventados con ese estilo; el chat real NO está en el repositorio.
- **2026-10-08 · La IA extrae `entregados` y el código deduce la vuelta.** Nuevo campo `entregados` (solo si el repartidor lo dice). El código calcula `vuelta = salida − entregados` (o `salida = entregados + vuelta`), marca error si los entregados superan la salida y dudoso si salida/vuelta/entregados no cuadran. Cambia la regla del SPEC "deduce vuelta" en el prompt: ahora la IA no resta, solo copia. Refuerza "el código suma".
- **2026-10-08 · Varios mensajes del mismo día se unen** (los null se completan entre sí); solo hay conflicto si hay dos cifras distintas en el mismo campo.
- **2026-10-08 · La IA devuelve los números de los mensajes (`#n`), no su texto.** El código construye `mensaje_original` con el texto real (con fecha y hora). Menos tokens/tiempo y sin riesgo de que la IA altere el original.
- **2026-10-08 · Fecha explícita del mensaje manda** ("17/7", "01/08", "11 de agosto") sobre la fecha de envío. A la IA se envían también los mensajes de los 3 primeros días del mes siguiente (antes solo la madrugada del día 1), porque las entregas del último día llegan tarde. El código descarta lo que caiga fuera del mes.
- **2026-10-08 · No se envían a la IA los mensajes que son solo un código** (DNI/NIE, nº de seguimiento): no aportan datos y son datos de terceros (regla de enviar solo lo necesario).
- **2026-10-08 · Lector:** las marcas "imagen omitida"/`<adjunto: …>` pegadas al texto se quitan (se conserva el pie); el nombre del archivo tolera guiones bajos y un número final pegado ("…Luisa2.zip"); y empareja "Juan" con "Juan Pérez".
- **2026-10-08 · Cifras atípicas por factor, no por porcentaje:** dudoso si supera 3× lo habitual (mediana) o es menos de 1/3. Con el 50 % se marcaban como dudosos días normales de un repartidor que varía entre 9 y 39 paquetes.
- **2026-10-08 · Modelo por defecto: `claude-sonnet-5-5` (cambia lo del SPEC, que pedía Haiku 4.5).** Mismo chat real (julio), comparando: Haiku 4.5 y 5.5 se saltan días con fecha explícita (10/7, 18/7), Haiku 4.5 marca un error falso (21/7) e inventa una vuelta de 7 el 20/7, Haiku 5.5 se queda con 21 en vez de 23 el 31/7; Sonnet 5.5 los acierta. Coste medido: ~6.400 tokens de entrada + ~3.600 de salida ≈ 5 céntimos por repartidor y mes (~21 s); Haiku 5.5 ≈ 0,3 céntimos. Se cambia con `ANTHROPIC_MODEL`. Sonnet 5.5 no admite forzar la herramienta (`tool_choice`), así que con él se usa `auto`; el prompt la pide.
- **2026-10-08 · Pendiente de decidir con el cliente:** este chat sugiere que algunos repartidores reportan con fotos/hojas de ruta además de texto, y que "incidencias" (paquetes no entregados) forman parte del reporte. Hoy las incidencias solo se usan como contexto, no como campo.
- **2026-10-08 · Solo importan los entregados (indicado por el dueño).** Las incidencias se ignoran (el prompt lo dice). `registros_dia` guarda `entregados` (migración `registros_entregados`) y es la cifra autoritativa para totales y pago; salida y vuelta son secundarias. Un día con solo "34 entreg" es válido (`ok`) aunque no haya salida. Dudoso = no se pueden saber los entregados, confianza baja, conflicto o no cuadra; error = vuelta > salida o entregados > salida. La regla de cifras atípicas mira solo los entregados. Ya no se generan notas de "vuelta deducida" (ruido).
- **2026-10-08 · También se guardan los `motivos` de cada día dudoso/erróneo** (columna `motivos`) para mostrarlos en la revisión.
- **2026-10-08 · Flujo de importación en dos pasos.** (1) `/api/importar/analizar`: sin IA, lee todos los archivos, detecta dueño y repartidores y avisa de lo que se reemplazaría. (2) `/api/importar/procesar`: un archivo por petición, hasta 3 a la vez desde el cliente (así cada petición es corta y se ve el progreso por chat). El archivo original no se guarda. Con 3 chats y Sonnet 5.5: ~8 s; un mes entero de un repartidor activo (~120 mensajes): ~25 s.
- **2026-10-08 · Dueño:** la primera vez se pide confirmación (aunque se detecte solo) y se guarda en Ajustes; después ya no se pregunta. Editable en Ajustes.
- **2026-10-08 · Volver a importar un repartidor en un mes reemplaza todos sus días de ese mes** (incluidas ediciones manuales); la pantalla avisa antes de cuántos días y cuántos editados a mano se pierden. Un mes cerrado bloquea importar, editar y marcar revisado.
- **2026-10-08 · Nombre del repartidor:** manda el nombre real del remitente en el chat; el nombre del archivo solo se usa para emparejar si coincide con él. Evita confundir al repartidor con el dueño si el chat se exportó desde el móvil del otro.
- **2026-10-08 · Edición manual:** al cambiar salida o vuelta (y estar las dos) los entregados se recalculan; si se editan los entregados se respetan. Una edición manual resuelve la duda (queda `ok` si hay entregados coherentes) y el día queda marcado como "Editado". "Marcar como revisado" marca todos los días del repartidor en el mes (y se puede quitar).
- **2026-10-08 · La pantalla de revisión usa tarjetas por debajo de 768 px y tabla a partir de ahí.** Los totales y el importe se recalculan en el cliente con las mismas funciones puras que usa el servidor. En la tabla solo salen los días con datos y los laborables sin datos (en gris); los domingos sin datos no.
- **2026-10-08 · El importe a pagar ya se calcula en las tarjetas** (`calcularPago`: por paquete, por día o fijo + variable, más ajustes). La pantalla para añadir ajustes, el Excel, el PDF y el cierre de mes son la Fase 4.
- **2026-10-08 · SIN LOGIN todavía (Fase 5).** La app no debe exponerse en internet hasta entonces. El acceso a la empresa pasa por `obtenerEmpresa()` (src/lib/empresa.ts) y todas las consultas reciben `empresaId`, así que ahí se enchufará la sesión.
- **2026-10-08 · Carrera al crear el mes:** al procesar varios archivos a la vez, todos intentaban crear el mismo mes y fallaban (lo encontró la prueba en el navegador). Ahora "obtener o crear" tolera la colisión, y cualquier error inesperado queda anotado en la importación.
- **2026-10-08 · Tests de integración con base de datos** (`tests/db.test.ts`): usan una empresa temporal en el Postgres local y se omiten solos si no hay base de datos.
- **2026-10-08 · Login adelantado desde la Fase 5 para poder probar en internet con el cliente.** Email + contraseña (bcrypt con `bcryptjs`, coste 12), sin registro público. Sesión en cookie firmada (JWT HS256 con `jose`, `httpOnly`, `sameSite=lax`, `secure` en producción, 30 días) que exige `SESSION_SECRET` de 32+ caracteres en producción. Barrera rápida en `src/proxy.ts` (Next 16 renombra middleware a proxy) y comprobación real (usuario existe, empresa) en `obtenerEmpresa()`/`obtenerEmpresaApi()` en cada página, acción de servidor y ruta API (401). Límite de 5 intentos fallidos por email y por IP cada 15 min (en memoria). Redirección tras login solo a rutas internas. Cabeceras: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`.
- **2026-10-08 · Usuarios:** `npm run crear-usuario -- email "contraseña"` (o `--cambiar-contrasena`). En producción, `scripts/arranque.ts` crea el usuario inicial desde `ADMIN_EMAIL`/`ADMIN_PASSWORD` solo si no hay ninguno (se puede borrar `ADMIN_PASSWORD` después). Probado el primer arranque sobre una base de datos vacía.
- **2026-10-08 · Despliegue en Railway:** `railway.json` (Railpack, `npm run build`, `npm run start:prod` = migraciones + usuario inicial + `next start`, healthcheck en `/login`). `prisma` y `tsx` pasan a `dependencies` para poder migrar al arrancar; `postinstall` genera el cliente de Prisma. Guía paso a paso en `DESPLIEGUE.md`. Railway marca la configuración como código (`railway.json`) como obsoleta a partir del 2026-12-01: si deja de leerse, poner los dos comandos en los ajustes del servicio (la guía lo explica).
