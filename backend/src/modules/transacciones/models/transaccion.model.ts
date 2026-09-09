import { query } from '../../../config/db';

export type TipoTransaccion = 'ingreso' | 'egreso';

export interface TransaccionRow {
  id: number;
  usuario_id: number;
  nombre: string;
  tipo: TipoTransaccion;
  cuenta_id: number | null;
  meta_id: number | null;
  categoria: string;
  descripcion: string | null;
  monto_original: string;
  moneda_original: string;
  tasa_cambio_usada: string;
  monto_gtq: string;
  created_at: Date;
}

export interface NuevaTransaccion {
  usuarioId: number;
  nombre: string;
  tipo: TipoTransaccion;
  cuentaId: number | null;
  metaId: number | null;
  categoria: string;
  descripcion: string | null;
  montoOriginal: number;
  monedaOriginal: string;
  tasaCambioUsada: number;
  montoGtq: number;
}

export interface TransaccionFiltro {
  tipo?: TipoTransaccion;
  categoria?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

export interface ResumenMes {
  ingreso: number;
  egreso: number;
}

function construirFiltros(usuarioId: number, filtro: TransaccionFiltro): { condiciones: string[]; values: unknown[]; nextIndex: number } {
  const condiciones: string[] = ['usuario_id = $1'];
  const values: unknown[] = [usuarioId];
  let index = 2;

  if (filtro.tipo !== undefined) {
    condiciones.push(`tipo = $${index++}`);
    values.push(filtro.tipo);
  }
  if (filtro.categoria !== undefined && filtro.categoria !== '') {
    condiciones.push(`LOWER(categoria) = LOWER($${index++})`);
    values.push(filtro.categoria);
  }
  if (filtro.desde) {
    condiciones.push(`created_at::date >= $${index++}::date`);
    values.push(filtro.desde);
  }
  if (filtro.hasta) {
    condiciones.push(`created_at::date <= $${index++}::date`);
    values.push(filtro.hasta);
  }
  if (filtro.busqueda) {
    const patron = `%${filtro.busqueda}%`;
    condiciones.push(`(LOWER(nombre) LIKE $${index} OR LOWER(COALESCE(descripcion, '')) LIKE $${index})`);
    values.push(patron);
    index++;
  }

  return { condiciones, values, nextIndex: index };
}

export async function sumMesPorTipo(usuarioId: number): Promise<ResumenMes> {
  const { rows } = await query<{ tipo: TipoTransaccion; total: string }>(
    `SELECT tipo, COALESCE(SUM(monto_gtq), 0)::text AS total
     FROM transacciones
     WHERE usuario_id = $1
       AND date_trunc('month', created_at) = date_trunc('month', now())
     GROUP BY tipo`,
    [usuarioId],
  );
  const resumen: ResumenMes = { ingreso: 0, egreso: 0 };
  for (const fila of rows) {
    resumen[fila.tipo] = Number(fila.total);
  }
  return resumen;
}

export async function sumarPorFiltro(usuarioId: number, filtro: TransaccionFiltro = {}): Promise<ResumenMes> {
  const { condiciones, values } = construirFiltros(usuarioId, filtro);
  const { rows } = await query<{ tipo: TipoTransaccion; total: string }>(
    `SELECT tipo, COALESCE(SUM(monto_gtq), 0)::text AS total
     FROM transacciones
     WHERE ${condiciones.join(' AND ')}
     GROUP BY tipo`,
    values,
  );
  const resumen: ResumenMes = { ingreso: 0, egreso: 0 };
  for (const fila of rows) {
    resumen[fila.tipo] = Number(fila.total);
  }
  return resumen;
}

export async function findAllByUsuario(usuarioId: number, filtro: TransaccionFiltro = {}): Promise<TransaccionRow[]> {
  const { condiciones, values, nextIndex } = construirFiltros(usuarioId, filtro);
  let index = nextIndex;

  const limit = Math.min(filtro.limit ?? 100, 500);
  values.push(limit);
  const offset = Math.max(0, filtro.offset ?? 0);
  values.push(offset);

  const { rows } = await query<TransaccionRow>(
    `SELECT * FROM transacciones WHERE ${condiciones.join(' AND ')}
     ORDER BY created_at DESC, id DESC LIMIT $${index} OFFSET $${index + 1}`,
    values,
  );
  return rows;
}

export async function findByIdAndUsuario(usuarioId: number, id: number): Promise<TransaccionRow | undefined> {
  const { rows } = await query<TransaccionRow>('SELECT * FROM transacciones WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0];
}

export async function create(data: NuevaTransaccion): Promise<TransaccionRow> {
  const { rows } = await query<TransaccionRow>(
    `INSERT INTO transacciones (usuario_id, nombre, tipo, cuenta_id, meta_id, categoria, descripcion, monto_original, moneda_original, tasa_cambio_usada, monto_gtq)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.usuarioId,
      data.nombre,
      data.tipo,
      data.cuentaId,
      data.metaId,
      data.categoria,
      data.descripcion,
      data.montoOriginal,
      data.monedaOriginal,
      data.tasaCambioUsada,
      data.montoGtq,
    ],
  );
  return rows[0];
}

export async function update(id: number, data: Partial<NuevaTransaccion>): Promise<TransaccionRow | undefined> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (data.nombre !== undefined) {
    sets.push(`nombre = $${index++}`);
    values.push(data.nombre);
  }
  if (data.tipo !== undefined) {
    sets.push(`tipo = $${index++}`);
    values.push(data.tipo);
  }
  if (data.cuentaId !== undefined) {
    sets.push(`cuenta_id = $${index++}`);
    values.push(data.cuentaId);
  }
  if (data.metaId !== undefined) {
    sets.push(`meta_id = $${index++}`);
    values.push(data.metaId);
  }
  if (data.categoria !== undefined) {
    sets.push(`categoria = $${index++}`);
    values.push(data.categoria);
  }
  if (data.descripcion !== undefined) {
    sets.push(`descripcion = $${index++}`);
    values.push(data.descripcion);
  }
  if (data.montoOriginal !== undefined) {
    sets.push(`monto_original = $${index++}`);
    values.push(data.montoOriginal);
  }
  if (data.monedaOriginal !== undefined) {
    sets.push(`moneda_original = $${index++}`);
    values.push(data.monedaOriginal);
  }
  if (data.tasaCambioUsada !== undefined) {
    sets.push(`tasa_cambio_usada = $${index++}`);
    values.push(data.tasaCambioUsada);
  }
  if (data.montoGtq !== undefined) {
    sets.push(`monto_gtq = $${index++}`);
    values.push(data.montoGtq);
  }

  if (sets.length === 0) return undefined;

  values.push(id);
  const { rows } = await query<TransaccionRow>(
    `UPDATE transacciones SET ${sets.join(', ')} WHERE id = $${index} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function remove(id: number): Promise<boolean> {
  const result = await query('DELETE FROM transacciones WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}