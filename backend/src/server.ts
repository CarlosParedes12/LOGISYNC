import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool } from "./database.js";
import paquetesRouter from "./routes/paquetes.routes.js";
import authRouter from "./routes/auth.routes.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    mensaje: "API de LOGISYNC funcionando correctamente"
  });
});

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

// Rutas del sistema
app.use("/api/paquetes", paquetesRouter);
app.use("/api/auth", authRouter);

// El servidor se inicia al final
app.listen(PORT, () => {
  console.log(
    `Servidor LOGISYNC ejecutándose en http://localhost:${PORT}`
  );
});