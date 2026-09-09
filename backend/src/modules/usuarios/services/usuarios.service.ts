import bcrypt from 'bcrypt';
import * as usuarioModel from '../models/usuario.model';
import { ConflictError, NotFoundError } from '../../../utils/errors';

const BCRYPT_ROUNDS = 10;

export interface UsuarioPublico {
  id: number;
  email: string;
  rol: 'admin' | 'cliente';
  createdAt: Date;
}

export interface CrearUsuario {
  email: string;
  password: string;
  rol?: 'admin' | 'cliente';
}

export interface ActualizarUsuarioDatos {
  email?: string;
  password?: string;
  rol?: 'admin' | 'cliente';
}

export function toUsuarioPublico(row: usuarioModel.UsuarioRow): UsuarioPublico {
  return {
    id: row.id,
    email: row.email,
    rol: row.rol,
    createdAt: row.created_at,
  };
}

export async function listar(): Promise<UsuarioPublico[]> {
  const rows = await usuarioModel.findAll();
  return rows.map(toUsuarioPublico);
}

export async function obtenerPorId(id: number): Promise<UsuarioPublico> {
  const row = await usuarioModel.findById(id);
  if (!row) throw new NotFoundError(`Usuario ${id} no encontrado`);
  return toUsuarioPublico(row);
}

export async function obtenerPorEmail(email: string): Promise<usuarioModel.UsuarioRow | undefined> {
  return usuarioModel.findByEmail(email);
}

export async function crear(datos: CrearUsuario): Promise<UsuarioPublico> {
  const existente = await usuarioModel.findByEmail(datos.email);
  if (existente) throw new ConflictError('Ya existe un usuario con ese email');

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);
  return crearRow({
    email: datos.email,
    password_hash: passwordHash,
    rol: datos.rol ?? 'cliente',
  });
}

export async function crearUsuarioOAuth(email: string): Promise<UsuarioPublico> {
  try {
    return await crearRow({
      email,
      password_hash: null,
      rol: 'cliente',
    });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      const existente = await usuarioModel.findByEmail(email);
      if (existente) return toUsuarioPublico(existente);
    }
    throw error;
  }
}

async function crearRow(datos: {
  email: string;
  password_hash: string | null;
  rol: 'admin' | 'cliente';
}): Promise<UsuarioPublico> {
  const row = await usuarioModel.create({
    email: datos.email,
    password_hash: datos.password_hash,
    rol: datos.rol,
  });
  return toUsuarioPublico(row);
}

export async function actualizar(id: number, datos: ActualizarUsuarioDatos): Promise<UsuarioPublico> {
  const actual = await usuarioModel.findById(id);
  if (!actual) throw new NotFoundError(`Usuario ${id} no encontrado`);

  if (datos.email !== undefined && datos.email !== actual.email) {
    const existente = await usuarioModel.findByEmail(datos.email);
    if (existente) throw new ConflictError('Ya existe un usuario con ese email');
  }

  const updated = await usuarioModel.update(id, {
    email: datos.email,
    rol: datos.rol,
    password_hash: datos.password ? await bcrypt.hash(datos.password, BCRYPT_ROUNDS) : undefined,
  });

  return toUsuarioPublico(updated as usuarioModel.UsuarioRow);
}

export async function eliminar(id: number): Promise<void> {
  const eliminado = await usuarioModel.remove(id);
  if (!eliminado) throw new NotFoundError(`Usuario ${id} no encontrado`);
}