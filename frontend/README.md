# LOGISYNC - Interfaz web para BPGroupGT

Frontend de demostración académica basado en React + TypeScript + Vite. Conecta con el backend local existente: Node.js/Express/PostgreSQL.

## Instalación en Windows

1. Descomprime el ZIP de entrega y COPIA la carpeta `frontend` completa a `D:\Proyectos\LOGISYNC\frontend` (al mismo nivel que `backend`, no dentro de él).
2. Mantén activo el backend en una terminal: `cd D:\Proyectos\LOGISYNC\backend` y `npm run dev`.
3. Abre una SEGUNDA terminal:
   ```powershell
   cd D:\Proyectos\LOGISYNC\frontend
   npm install
   npm run dev
   ```
4. Abre Firefox en `http://localhost:5173`.
5. Accede con el administrador previamente creado en PostgreSQL y su contraseña actual. No hay usuarios ni contraseñas incluidas en este ZIP.

## Funciones incluidas
- Formulario de login JWT.
- Dashboard con métricas obtenidas de paquetes reales del backend.
- Lista, búsqueda y filtro de envíos.
- Registro de nuevo envío.
- Consulta del detalle e historial por número de guía.
- Actualización MANUAL del estado e incorporación al historial.
- Administración de usuarios solo para administrador: registrar operadores y activar/desactivar operadores.
- Sesiones almacenadas temporalmente en `sessionStorage` para la demostración.

## Límites honestos
- La integración automática con las API de transportistas todavía NO existe. La interfaz lo indica expresamente.
- La consulta pública anónima no está implementada. La consulta actual requiere JWT.
- No se incluyen datos falsificados: todas las tablas proceden de PostgreSQL.
- No se incluye un despliegue público en internet ni medidas completas de producción (HTTPS, políticas de cookies, recuperación de contraseña, auditoría y límites de acceso).

## Si hay error de conexión
- Deben estar abiertos ambos servidores: backend 3000 y frontend 5173.
- Verifica `http://localhost:3000/api/database`.
- El backend conocido utiliza `app.use(cors())` durante desarrollo y permite conexiones locales desde 5173.
- Si ya tienes el frontend creado, respalda archivos antes de reemplazarlos.

## Comprobaciones finales
- `npm run build` (se ejecuta dentro de `frontend`).
- En el backend, `npx tsc --noEmit`.
- No subas archivos `.env`, contraseñas, tokens ni `node_modules` a GitHub.
