export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type Role = 'administrador' | 'operador';
export interface UsuarioSesion { id: string; nombre: string; correo: string; rol: Role; }
export interface LoginResponse { mensaje: string; token: string; usuario: UsuarioSesion; }
export interface Usuario { id: string; nombre: string; correo: string; rol: Role; activo: boolean; fecha_creacion?: string; }
export interface Paquete {
  id: string;
  numero_guia: string;
  nombre_cliente: string;
  origen: string;
  destino: string;
  proveedor_logistico?: string | null;
  estado_actual: string;
  ubicacion_actual?: string | null;
  descripcion?: string | null;
  fecha_ingreso?: string;
  ultima_actualizacion?: string;
}
export interface Historial {
  id: string;
  estado: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  fuente?: string;
  fecha_evento?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'No fue posible conectar con el servidor. Comprueba que npm run dev esté activo en el backend.');
  }
  const raw = await response.text();
  let data: unknown = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    const mensaje = (data && typeof data === 'object' && 'mensaje' in data && typeof data.mensaje === 'string')
      ? data.mensaje : `Error HTTP ${response.status}`;
    throw new ApiError(response.status, mensaje);
  }
  return data as T;
}
