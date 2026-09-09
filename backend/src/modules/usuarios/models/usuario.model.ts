import { query } from '../../../config/db';

export interface UsuarioRow {
  id: number;
  email: string;
  password_hash: string | null;
  rol: 'admin' | 'cliente';
  created_at: Date;
  updated_at: Date;
}

export interface NuevoUsuario {
  email: string;
  password_hash?: string | null;
  rol: 'admin' | 'cliente';
}

export interface ActualizarUsuario {
  email?: string;
  password_hash?: string;
  rol?: 'admin' | 'cliente';
}

export async function findAll(): Promise<UsuarioRow[]> {
  const { rows } = await query<UsuarioRow>('SELECT * FROM usuarios ORDER BY id');
  return rows;
}

export async function findById(id: number): Promise<UsuarioRow | undefined> {
  const { rows } = await query<UsuarioRow>('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0];
}

export async function findByEmail(email: string): Promise<UsuarioRow | undefined> {
  const { rows } = await query<UsuarioRow>('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows[0];
}

export async function create(datos: NuevoUsuario): Promise<UsuarioRow> {
  const { rows } = await query<UsuarioRow>(
    `INSERT INTO usuarios (email, password_hash, rol)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [datos.email, datos.password_hash ?? null, datos.rol],
  );
  return rows[0];
}

export async function update(id: number, datos: ActualizarUsuario): Promise<UsuarioRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (datos.email !== undefined) {
    sets.push(`email = $${index++}`);
    values.push(datos.email);
  }
  if (datos.password_hash !== undefined) {
    sets.push(`password_hash = $${index++}`);
    values.push(datos.password_hash);
  }
  if (datos.rol !== undefined) {
    sets.push(`rol = $${index++}`);
    values.push(datos.rol);
  }

  if (sets.length === 0) return findById(id);

  values.push(id);
  const { rows } = await query<UsuarioRow>(
    `UPDATE usuarios SET ${sets.join(', ')}, updated_at = now() WHERE id = $${index} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function remove(id: number): Promise<boolean> {
  const result = await query('DELETE FROM usuarios WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}