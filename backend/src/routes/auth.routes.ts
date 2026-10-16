import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../database.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({
      mensaje: "Correo y contraseña son obligatorios"
    });
  }

  try {
    const resultado = await pool.query(
      `
      SELECT
        id,
        nombre,
        correo,
        password_hash,
        rol,
        activo
      FROM usuarios
      WHERE correo = $1
      `,
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    const usuario = resultado.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "Usuario inactivo"
      });
    }

    const passwordCorrecto = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordCorrecto) {
      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    const secreto = process.env.JWT_SECRET;

    if (!secreto) {
      throw new Error("JWT_SECRET no está configurado");
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        correo: usuario.correo,
        rol: usuario.rol
      },
      secreto,
      {
        expiresIn: "8h"
      }
    );

    res.json({
      mensaje: "Inicio de sesión correcto",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    res.status(500).json({
      mensaje: "Error interno al iniciar sesión"
    });
  }
});

export default router;