import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../database.js";

const nombre = process.env.ADMIN_NAME;
const correo = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

async function crearAdmin() {
  if (!nombre || !correo || !password) {
    console.error(
      "Faltan ADMIN_NAME, ADMIN_EMAIL o ADMIN_PASSWORD."
    );

    process.exit(1);
  }

  try {
    const existe = await pool.query(
      `
      SELECT id
      FROM usuarios
      WHERE correo = $1
      `,
      [correo]
    );

    if (existe.rows.length > 0) {
      console.log("Ya existe un usuario con ese correo.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `
      INSERT INTO usuarios (
        nombre,
        correo,
        password_hash,
        rol,
        activo
      )
      VALUES ($1, $2, $3, 'administrador', TRUE)
      RETURNING id, nombre, correo, rol, activo
      `,
      [
        nombre,
        correo,
        passwordHash
      ]
    );

    console.log("Administrador creado correctamente:");
    console.table(resultado.rows);

  } catch (error) {
    console.error("Error al crear administrador:", error);

  } finally {
    await pool.end();
  }
}

crearAdmin();