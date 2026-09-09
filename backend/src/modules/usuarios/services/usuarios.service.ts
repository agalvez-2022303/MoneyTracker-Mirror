import bcrypt from 'bcrypt';
import * as usuarioModel from '../models/usuario.model';
import * as cuentaModel from '../../cuentas/models/cuenta.model';
import * as metaModel from '../../metas/models/meta.model';
import * as transaccionModel from '../../transacciones/models/transaccion.model';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../../utils/errors';

const BCRYPT_ROUNDS = 10;

export interface UsuarioPublico {
  id: number;
  email: string;
  nombre: string | null;
  rol: 'admin' | 'cliente';
  createdAt: Date;
}

export interface CrearUsuario {
  email: string;
  password: string;
  nombre?: string;
  rol?: 'admin' | 'cliente';
}

export interface ActualizarUsuarioDatos {
  email?: string;
  password?: string;
  nombre?: string | null;
  rol?: 'admin' | 'cliente';
}

export function toUsuarioPublico(row: usuarioModel.UsuarioRow): UsuarioPublico {
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
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
    nombre: datos.nombre ?? null,
    rol: datos.rol ?? 'cliente',
  });
}

export async function crearUsuarioOAuth(email: string, nombre?: string | null): Promise<UsuarioPublico> {
  try {
    return await crearRow({
      email,
      password_hash: null,
      nombre: nombre ?? null,
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
  nombre: string | null;
  rol: 'admin' | 'cliente';
}): Promise<UsuarioPublico> {
  const row = await usuarioModel.create({
    email: datos.email,
    password_hash: datos.password_hash,
    nombre: datos.nombre,
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
    nombre: datos.nombre,
  });

  return toUsuarioPublico(updated as usuarioModel.UsuarioRow);
}

export async function cambiarPassword(
  id: number,
  passwordActual: string | undefined,
  nuevaPassword: string,
): Promise<void> {
  const usuario = await usuarioModel.findById(id);
  if (!usuario) throw new NotFoundError(`Usuario ${id} no encontrado`);

  if (usuario.password_hash) {
    if (!passwordActual) {
      throw new BadRequestError('Debes ingresar tu contraseña actual');
    }
    const esValida = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!esValida) {
      throw new UnauthorizedError('La contraseña actual es incorrecta');
    }
  }

  const nuevoHash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);
  await usuarioModel.update(id, { password_hash: nuevoHash });
}

export async function exportarDatos(usuarioId: number): Promise<{
  usuario: UsuarioPublico;
  cuentas: cuentaModel.CuentaRow[];
  metas: metaModel.MetaRow[];
  transacciones: transaccionModel.TransaccionRow[];
}> {
  const usuario = await obtenerPorId(usuarioId);
  const [cuentas, metas, transacciones] = await Promise.all([
    cuentaModel.findAllByUsuario(usuarioId),
    metaModel.findAllByUsuario(usuarioId),
    transaccionModel.findAllByUsuario(usuarioId, {}),
  ]);

  return { usuario, cuentas, metas, transacciones };
}

export async function eliminar(id: number): Promise<void> {
  const eliminado = await usuarioModel.remove(id);
  if (!eliminado) throw new NotFoundError(`Usuario ${id} no encontrado`);
}