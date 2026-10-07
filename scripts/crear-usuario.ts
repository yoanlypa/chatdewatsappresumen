/**
 * Crea el usuario del dueño (no hay registro público) o cambia su contraseña.
 *   npm run crear-usuario -- correo@empresa.com "contraseña-larga" ["Nombre de la empresa"]
 *   npm run crear-usuario -- --cambiar-contrasena correo@empresa.com "nueva-contraseña"
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { cambiarContrasena, crearUsuario, ErrorUsuario } from "../src/lib/usuarios";

const args = process.argv.slice(2);
const cambiar = args[0] === "--cambiar-contrasena";
const [email, contrasena, empresa] = cambiar ? args.slice(1) : args;

if (!email || !contrasena) {
  console.error('Uso: npm run crear-usuario -- correo@empresa.com "contraseña-larga" ["Nombre de la empresa"]');
  console.error('     npm run crear-usuario -- --cambiar-contrasena correo@empresa.com "nueva-contraseña"');
  process.exit(1);
}

try {
  if (cambiar) {
    await cambiarContrasena(prisma, email, contrasena);
    console.log(`✔ Contraseña de ${email} actualizada.`);
  } else {
    const u = await crearUsuario(prisma, { email, contrasena, nombreEmpresa: empresa });
    console.log(`✔ Usuario ${u.email} creado.`);
  }
} catch (e) {
  console.error(`✖ ${e instanceof ErrorUsuario ? e.message : e}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
