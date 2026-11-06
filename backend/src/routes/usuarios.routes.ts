
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../database.js";

const router = Router();

// Consultar usuarios registrados
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, correo, rol, activo,
              fecha_creacion
       FROM usuarios
       ORDER BY id ASC`
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar usuarios:", error);

    res.status(500).json({
      mensaje: "Error al consultar usuarios."
    });
  }
});

// Registrar un nuevo operador
router.post("/", async (req, res) => {
  const { nombre, correo, password } = req.body ?? {};

  if (
    typeof nombre !== "string" ||
    typeof correo !== "string" ||
    typeof password !== "string"
  ) {
    res.status(400).json({
      mensaje: "Nombre, correo y contraseña son obligatorios."
    });
    return;
  }

  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim().toLowerCase();

  if (!nombreLimpio || !correoLimpio || !password) {
    res.status(400).json({
      mensaje: "Los campos no pueden estar vacíos."
    });
    return;
  }

  if (nombreLimpio.length > 150 ||
      correoLimpio.length > 150) {
    res.status(400).json({
      mensaje: "Nombre o correo demasiado largo."
    });
    return;
  }

  const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!formatoCorreo.test(correoLimpio)) {
    res.status(400).json({
      mensaje: "El correo electrónico no es válido."
    });
    return;
  }

  if (
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    res.status(400).json({
      mensaje: "La contraseña debe tener al menos 12 caracteres y un máximo de 72 bytes."
    });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `INSERT INTO usuarios
       (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'operador', TRUE)
       RETURNING id, nombre, correo, rol, activo,
                 fecha_creacion`,
      [nombreLimpio, correoLimpio, passwordHash]
    );

    res.status(201).json({
      mensaje: "Operador registrado correctamente.",
      usuario: resultado.rows[0]
    });
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        mensaje: "Ya existe un usuario con ese correo."
      });
      return;
    }

    console.error("Error al registrar operador:", error);

    res.status(500).json({
      mensaje: "Error interno al registrar operador."
    });
  }
});


/**
 * Activar o desactivar la cuenta de un operador.
 * PATCH /api/usuarios/:id/activo
 *
 * Esta ruta solo es accesible para administradores,
 * gracias a los middlewares configurados en server.ts.
 */
router.patch("/:id/activo", async (req, res) => {
  const id = Number(req.params.id);
  const { activo } = req.body ?? {};

  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({
      mensaje: "El ID del usuario no es válido."
    });
    return;
  }

  if (typeof activo !== "boolean") {
    res.status(400).json({
      mensaje: "El campo activo debe ser true o false."
    });
    return;
  }

  try {
    const resultado = await pool.query(
      `UPDATE usuarios
       SET activo = $1
       WHERE id = $2
         AND rol = 'operador'
       RETURNING id, nombre, correo, rol, activo`,
      [activo, id]
    );

    if (resultado.rows.length === 0) {
      res.status(404).json({
        mensaje: "Operador no encontrado. Las cuentas de administrador no se modifican desde esta ruta."
      });
      return;
    }

    res.json({
      mensaje: activo
        ? "Operador activado correctamente."
        : "Operador desactivado correctamente.",
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error("Error al cambiar el estado del usuario:", error);

    res.status(500).json({
      mensaje: "Error interno al actualizar el usuario."
    });
  }
});


export default router;
