import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool } from "./database.js";
import paquetesRouter from "./routes/paquetes.routes.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.json({
    mensaje: "API de LOGISYNC funcionando correctamente"
  });
});

// Comprobar conexión con PostgreSQL
app.get("/api/database", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT NOW() AS fecha_servidor"
    );

    res.json({
      conexion: "PostgreSQL conectado correctamente",
      baseDeDatos: process.env.DB_NAME,
      fechaServidor: resultado.rows[0].fecha_servidor
    });
  } catch (error) {
    console.error("Error de conexión con PostgreSQL:", error);

    res.status(500).json({
      conexion: "Error al conectar con PostgreSQL"
    });
  }
});

// Rutas de paquetes
app.use("/api/paquetes", paquetesRouter);

app.listen(PORT, () => {
  console.log(
    `Servidor LOGISYNC ejecutándose en http://localhost:${PORT}`
  );
});