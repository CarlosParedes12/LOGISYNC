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
router.get("/:numeroGuia", async (req, res) => {
  const { numeroGuia } = req.params;

  try {
    const resultado = await pool.query(
      `
      SELECT *
      FROM paquetes
      WHERE numero_guia = $1
      `,
      [numeroGuia]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paquete no encontrado"
      });
    }

    res.json(resultado.rows[0]);

  } catch (error) {
    console.error("Error al consultar paquete:", error);

    res.status(500).json({
      mensaje: "Error al consultar el paquete"
    });
  }
});
// Obtener historial de un paquete por número de guía
router.get("/:numeroGuia/historial", async (req, res) => {
  const { numeroGuia } = req.params;

  try {
    // Primero buscamos el paquete
    const paqueteResultado = await pool.query(
      `
      SELECT id, numero_guia
      FROM paquetes
      WHERE numero_guia = $1
      `,
      [numeroGuia]
    );

    if (paqueteResultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: "Paquete no encontrado"
      });
    }

    const paqueteId = paqueteResultado.rows[0].id;

    // Después buscamos su historial
    const historialResultado = await pool.query(
      `
      SELECT
        id,
        estado,
        ubicacion,
        descripcion,
        fuente,
        fecha_evento,
        usuario_id
      FROM historial_estados
      WHERE paquete_id = $1
      ORDER BY fecha_evento DESC
      `,
      [paqueteId]
    );

    res.json({
      numero_guia: numeroGuia,
      historial: historialResultado.rows
    });

  } catch (error) {
    console.error("Error al consultar historial:", error);

    res.status(500).json({
      mensaje: "Error al consultar el historial del paquete"
    });
  }
});

// Actualizar estado de un paquete
router.patch("/:numeroGuia/estado", async (req, res) => {
  const { numeroGuia } = req.params;

  const {
    estado,
    ubicacion,
    descripcion
  } = req.body;

  if (!estado || !ubicacion) {
    return res.status(400).json({
      mensaje: "El estado y la ubicación son obligatorios"
    });
  }

  const estadosPermitidos = [
    "Registrado",
    "En bodega",
    "En tránsito",
    "En aduana",
    "Entregado",
    "Cancelado"
  ];

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({
      mensaje: "El estado proporcionado no es válido"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Buscar el paquete
    const paqueteResultado = await client.query(
      `
      SELECT id
      FROM paquetes
      WHERE numero_guia = $1
      `,
      [numeroGuia]
    );

    if (paqueteResultado.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        mensaje: "Paquete no encontrado"
      });
    }

    const paqueteId = paqueteResultado.rows[0].id;

    // Actualizar información actual del paquete
    const actualizacionResultado = await client.query(
      `
      UPDATE paquetes
      SET
        estado_actual = $1,
        ubicacion_actual = $2,
        ultima_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
      `,
      [
        estado,
        ubicacion,
        paqueteId
      ]
    );

    // Registrar movimiento en el historial
    await client.query(
      `
      INSERT INTO historial_estados (
        paquete_id,
        estado,
        ubicacion,
        descripcion,
        fuente
      )
      VALUES ($1, $2, $3, $4, 'manual')
      `,
      [
        paqueteId,
        estado,
        ubicacion,
        descripcion || "Actualización del estado del paquete"
      ]
    );

    await client.query("COMMIT");

    res.json({
      mensaje: "Estado actualizado correctamente",
      paquete: actualizacionResultado.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error al actualizar estado:", error);

    res.status(500).json({
      mensaje: "Error al actualizar el estado del paquete"
    });

  } finally {
    client.release();
  }
});
export default router;