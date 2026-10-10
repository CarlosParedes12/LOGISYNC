import { Router } from "express";
import { pool } from "../database.js";

const router = Router();

// Obtener todos los paquetes
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM paquetes
      ORDER BY fecha_ingreso DESC
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error("Error al consultar paquetes:", error);

    res.status(500).json({
      mensaje: "Error al consultar los paquetes"
    });
  }
});

// Registrar un nuevo paquete
router.post("/", async (req, res) => {
  const {
    numero_guia,
    nombre_cliente,
    origen,
    destino,
    proveedor_logistico,
    descripcion
  } = req.body;

  if (!numero_guia || !nombre_cliente || !origen || !destino) {
    return res.status(400).json({
      mensaje:
        "Número de guía, nombre del cliente, origen y destino son obligatorios"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paqueteResultado = await client.query(
      `
      INSERT INTO paquetes (
        numero_guia,
        nombre_cliente,
        origen,
        destino,
        proveedor_logistico,
        estado_actual,
        ubicacion_actual,
        descripcion
      )
      VALUES ($1, $2, $3, $4, $5, 'Registrado', $3, $6)
      RETURNING *
      `,
      [
        numero_guia,
        nombre_cliente,
        origen,
        destino,
        proveedor_logistico || null,
        descripcion || null
      ]
    );

    const paquete = paqueteResultado.rows[0];

    await client.query(
      `
      INSERT INTO historial_estados (
        paquete_id,
        estado,
        ubicacion,
        descripcion,
        fuente
      )
      VALUES ($1, 'Registrado', $2, $3, 'sistema')
      `,
      [
        paquete.id,
        origen,
        "Paquete registrado inicialmente en LOGISYNC"
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      mensaje: "Paquete registrado correctamente",
      paquete
    });
  } catch (error: any) {
    await client.query("ROLLBACK");

    console.error("Error al registrar paquete:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        mensaje: "Ya existe un paquete con ese número de guía"
      });
    }

    res.status(500).json({
      mensaje: "Error al registrar el paquete"
    });
  } finally {
    client.release();
  }
});

export default router;