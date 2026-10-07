# Cómo poner la app en internet (Railway)

Tiempo: unos 15 minutos. Todo se hace desde el navegador.

## Antes de empezar

1. **Pon el repositorio en privado** (recomendado): GitHub → el repo → *Settings* → *Danger Zone* → *Change visibility* → *Private*. Railway funciona igual con repos privados: te pedirá autorizar su acceso a GitHub.
2. Ten a mano tu **clave de Anthropic** (la de tu `.env`) y, en la consola de Anthropic, conviene poner un **límite de gasto mensual** para dormir tranquilo.
3. Decide el **email y la contraseña del dueño** (contraseña de 10 caracteres o más). Con ellos entrará tu cliente.

## 1. Crear el proyecto

1. Entra en <https://railway.com> y crea una cuenta (puedes entrar con GitHub). Revisa su plan de precios: para uso real hace falta un plan de pago.
2. **New Project** → **Deploy from GitHub repo** → elige `yoanlypa/chatdewatsappresumen` (si no sale, pulsa *Configure GitHub App* y dale acceso al repositorio).
3. El primer despliegue **va a fallar o a quedarse esperando**: es normal, aún faltan la base de datos y las variables.

## 2. Añadir la base de datos

1. En el proyecto: **+ New** → **Database** → **Add PostgreSQL**.

## 3. Variables de la app

Abre el servicio de la app (no el de Postgres) → pestaña **Variables** y añade:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Pulsa **Add Reference Variable** y elige `DATABASE_URL` del servicio *Postgres* |
| `ANTHROPIC_API_KEY` | tu clave de Anthropic |
| `SESSION_SECRET` | una cadena aleatoria larga (ver abajo) |
| `ADMIN_EMAIL` | el email del dueño |
| `ADMIN_PASSWORD` | la contraseña del dueño (10+ caracteres) |
| `EMPRESA_NOMBRE` | *(opcional)* nombre de la empresa del cliente |

Para generar `SESSION_SECRET`, en una terminal de tu PC:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Al guardar las variables, Railway vuelve a desplegar solo.

## 4. Sacar la dirección pública

Servicio de la app → **Settings** → **Networking** → **Generate Domain**. Te da una dirección tipo `https://algo.up.railway.app`.

## 5. Comprobar

1. Abre la dirección: debe salir la pantalla de **inicio de sesión**.
2. Entra con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
3. Ve a **Subir chats** y prueba con un chat.

El primer arranque crea las tablas y el usuario solo. **Después de entrar la primera vez, borra la variable `ADMIN_PASSWORD`** de Railway (el usuario ya existe y no hace falta guardarla ahí).

## 6. Usarla en el móvil

Abre la dirección en el navegador del móvil e inicia sesión. Para tenerla como icono: en Chrome (Android) menú ⋮ → *Añadir a pantalla de inicio*; en Safari (iPhone) botón compartir → *Añadir a pantalla de inicio*.

Para subir un chat desde el móvil: en WhatsApp, abre el chat → ⋮ → *Más* → *Exportar chat* → *Sin archivos* → elige **Guardar en Archivos / Drive**, y luego en la app pulsa *Elegir archivos*.

## Si algo falla

- **El despliegue no arranca y el log dice `Falta la variable SESSION_SECRET`**: añade esa variable (32+ caracteres).
- **`Authentication failed` / no conecta a la base de datos**: revisa que `DATABASE_URL` sea una *Reference Variable* al servicio Postgres y que ambos servicios estén en el mismo proyecto.
- **Railway no usa el comando de arranque**: en *Settings → Deploy → Custom Start Command* pon `npm run start:prod`, y en *Custom Build Command* pon `npm run build`.
- **No puedes entrar**: mira los *Deploy Logs*; debe aparecer `Usuario inicial creado`. Si el usuario ya existía con otra contraseña, cámbiala desde tu PC con la CLI de Railway: `railway run npm run crear-usuario -- --cambiar-contrasena correo@empresa.com "nueva-contraseña"`.
- **"Demasiados intentos"**: tras 5 contraseñas incorrectas seguidas se bloquea 15 minutos (o reinicia el servicio).

## Lo que cuesta

- **Anthropic**: con el modelo por defecto (Sonnet 5.5), unos 5 céntimos por repartidor y mes.
- **Railway**: lo que marque su plan (servicio de la app + Postgres).

## Qué falta todavía

Esta versión es para **probar** con el cliente: ya tiene login, importación, revisión y cálculo del importe. Todavía no están (Fase 4): añadir ajustes (adelantos, gasolina), exportar a Excel y PDF y cerrar el mes. Los datos de la base de datos no se copian solos: si quieres copias de seguridad, actívalas en el servicio de Postgres de Railway.
