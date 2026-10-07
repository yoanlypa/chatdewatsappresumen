/**
 * Se ejecuta al arrancar en producción (después de las migraciones).
 * Si todavía no hay ningún usuario y están ADMIN_EMAIL y ADMIN_PASSWORD, crea el del dueño.
 * Cuando ya existe un usuario no hace nada: se pueden borrar esas variables después del primer arranque.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { crearUsuario, ErrorUsuario } from "../src/lib/usuarios";

try {
  const email = process.env.ADMIN_EMAIL;
  const contrasena = process.env.ADMIN_PASSWORD;
  if ((await prisma.usuario.count()) === 0) {
    if (email && contrasena) {
      const u = await crearUsuario(prisma, { email, contrasena, nombreEmpresa: process.env.EMPRESA_NOMBRE });
      console.log(`✔ Usuario inicial creado: ${u.email}`);
    } else {
      console.warn("⚠ No hay usuarios y faltan ADMIN_EMAIL / ADMIN_PASSWORD: nadie podrá entrar.");
    }
  }
} catch (e) {
  // Un fallo aquí no debe impedir que la app arranque; se ve en los logs.
  console.error(`✖ No se pudo crear el usuario inicial: ${e instanceof ErrorUsuario ? e.message : e}`);
} finally {
  await prisma.$disconnect();
}
