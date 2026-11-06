
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../database.js";

export async function verificarToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const autorizacion = req.headers.authorization;

  if (!autorizacion?.startsWith("Bearer ")) {
    res.status(401).json({
      mensaje: "Acceso denegado. Debes iniciar sesión."
    });
    return;
  }

  const token = autorizacion.slice(7).trim();
  const secreto = process.env.JWT_SECRET;

  if (!secreto) {
    res.status(500).json({
      mensaje: "Error de configuración de autenticación."
    });
    return;
  }

  try {
    const datos = jwt.verify(token, secreto);

    if (
      typeof datos === "string" ||
      !datos.id ||
      (typeof datos.id !== "string" &&
        typeof datos.id !== "number")
    ) {
      res.status(401).json({
        mensaje: "Token inválido."
      });
      return;
    }

    const resultado = await pool.query(
      `SELECT id, correo, rol, activo
       FROM usuarios
       WHERE id = $1`,
      [datos.id]
    );

    if (resultado.rows.length === 0) {
      res.status(401).json({
        mensaje: "Usuario no encontrado."
      });
      return;
    }

    const usuario = resultado.rows[0];

    if (!usuario.activo) {
      res.status(403).json({
        mensaje: "Usuario inactivo."
      });
      return;
    }

    res.locals.usuario = {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        mensaje: "Token inválido o expirado."
      });
      return;
    }

    console.error("Error al verificar autenticación:", error);
    res.status(500).json({
      mensaje: "Error interno de autenticación."
    });
  }
}

export function permitirRoles(...rolesPermitidos: string[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const usuario = res.locals.usuario;

    if (!usuario) {
      res.status(401).json({
        mensaje: "Debes iniciar sesión."
      });
      return;
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      res.status(403).json({
        mensaje: "No tienes permisos para esta operación."
      });
      return;
    }

    next();
  };
}
