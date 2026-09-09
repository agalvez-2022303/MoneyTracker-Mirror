import * as transaccionModel from '../models/transaccion.model';
import * as cuentasService from '../../cuentas/services/cuentas.service';
import * as metasService from '../../metas/services/metas.service';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { toNumber } from '../../../utils/http';

export const TIPOS_TRANSACCION: transaccionModel.TipoTransaccion[] = ['ingreso', 'egreso'];

export type TipoTransaccion = transaccionModel.TipoTransaccion;

export interface TransaccionPublica {
  id: number;
  nombre: string;
  tipo: transaccionModel.TipoTransaccion;
  cuentaId: number | null;
  metaId: number | null;
  categoria: string;
  descripcion: string | null;
  montoOriginal: number;
  monedaOriginal: string;
  tasaCambioUsada: number;
  montoGtq: number;
  createdAt: Date;
}

export interface CrearTransaccion {
  nombre: string;
  tipo: transaccionModel.TipoTransaccion;
  cuentaId?: number;
  metaId?: number;
  montoOriginal: number;
  monedaOriginal?: string;
  tasaCambioUsada?: number;
  categoria?: string;
  descripcion?: string | null;
}

export interface ActualizarTransaccion {
  nombre?: string;
  tipo?: transaccionModel.TipoTransaccion;
  cuentaId?: number;
  metaId?: number;
  montoOriginal?: number;
  monedaOriginal?: string;
  tasaCambioUsada?: number;
  categoria?: string;
  descripcion?: string | null;
}

export function toTransaccionPublica(row: transaccionModel.TransaccionRow): TransaccionPublica {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    cuentaId: row.cuenta_id,
    metaId: row.meta_id,
    categoria: row.categoria,
    descripcion: row.descripcion,
    montoOriginal: toNumber(row.monto_original),
    monedaOriginal: row.moneda_original,
    tasaCambioUsada: toNumber(row.tasa_cambio_usada),
    montoGtq: toNumber(row.monto_gtq),
    createdAt: row.created_at,
  };
}

function validarMoneda(monedaOriginal: string | undefined, tasaCambioUsada: number | undefined): {
  moneda: string;
  tasa: number;
} {
  const moneda = monedaOriginal ?? 'GTQ';
  if (!/^[A-Z]{3}$/.test(moneda)) {
    throw new BadRequestError('El campo "moneda_original" debe ser un código de 3 letras (ej. GTQ, USD)');
  }

  if (moneda === 'GTQ') {
    return { moneda, tasa: 1 };
  }

  const tasa = tasaCambioUsada;
  if (tasa === undefined || !Number.isFinite(tasa) || tasa <= 0) {
    throw new BadRequestError('Debe enviar "tasa_cambio_usada" (> 0) cuando la moneda no es GTQ');
  }
  return { moneda, tasa };
}

async function validarDestino(
  usuarioId: number,
  cuentaId: number | undefined,
  metaId: number | undefined,
): Promise<{ cuentaId: number; metaId: number }> {
  const tieneCuenta = cuentaId !== undefined;
  const tieneMeta = metaId !== undefined;

  if (tieneCuenta === tieneMeta) {
    throw new BadRequestError('Debe enviar exactamente uno de "cuenta_id" o "meta_id"');
  }

  if (tieneCuenta) {
    await cuentasService.obtenerPorId(usuarioId, cuentaId as number);
  } else {
    await metasService.obtenerPorId(usuarioId, metaId as number);
  }

  return {
    cuentaId: tieneCuenta ? (cuentaId as number) : -1,
    metaId: tieneMeta ? (metaId as number) : -1,
  };
}

function construirMonto(moneda: string, tasa: number, montoOriginal: number): number {
  return Math.round((montoOriginal * tasa) * 100) / 100;
}

async function aplicarEfecto(
  usuarioId: number,
  destino: { cuentaId: number; metaId: number },
  tipo: transaccionModel.TipoTransaccion,
  montoGtq: number,
): Promise<void> {
  if (destino.cuentaId > 0) {
    const delta = tipo === 'ingreso' ? montoGtq : -montoGtq;
    await cuentasService.ajustarSaldo(usuarioId, destino.cuentaId, delta);
  } else if (destino.metaId > 0) {
    const delta = tipo === 'egreso' ? montoGtq : -montoGtq;
    await metasService.ajustarMontoActual(usuarioId, destino.metaId, delta);
  }
}

export async function listar(
  usuarioId: number,
  filtro: transaccionModel.TransaccionFiltro = {},
): Promise<TransaccionPublica[]> {
  const rows = await transaccionModel.findAllByUsuario(usuarioId, filtro);
  return rows.map(toTransaccionPublica);
}

export async function resumir(
  usuarioId: number,
  filtro: transaccionModel.TransaccionFiltro = {},
): Promise<transaccionModel.ResumenMes> {
  return transaccionModel.sumarPorFiltro(usuarioId, filtro);
}

export async function obtenerPorId(usuarioId: number, id: number): Promise<TransaccionPublica> {
  const row = await transaccionModel.findByIdAndUsuario(usuarioId, id);
  if (!row) throw new NotFoundError(`Transacción ${id} no encontrada`);
  return toTransaccionPublica(row);
}

export async function crear(usuarioId: number, datos: CrearTransaccion): Promise<TransaccionPublica> {
  if (datos.montoOriginal <= 0) {
    throw new BadRequestError('El monto original debe ser mayor a 0');
  }

  const { moneda, tasa } = validarMoneda(datos.monedaOriginal, datos.tasaCambioUsada);
  const destino = await validarDestino(usuarioId, datos.cuentaId, datos.metaId);
  const montoGtq = construirMonto(moneda, tasa, datos.montoOriginal);

  const row = await transaccionModel.create({
    usuarioId,
    nombre: datos.nombre,
    tipo: datos.tipo,
    cuentaId: destino.cuentaId > 0 ? destino.cuentaId : null,
    metaId: destino.metaId > 0 ? destino.metaId : null,
    categoria: datos.categoria ?? 'otro',
    descripcion: datos.descripcion ?? null,
    montoOriginal: datos.montoOriginal,
    monedaOriginal: moneda,
    tasaCambioUsada: tasa,
    montoGtq,
  });

  await aplicarEfecto(usuarioId, destino, datos.tipo, montoGtq);
  return toTransaccionPublica(row);
}

export async function actualizar(usuarioId: number, id: number, datos: ActualizarTransaccion): Promise<TransaccionPublica> {
  const actual = await transaccionModel.findByIdAndUsuario(usuarioId, id);
  if (!actual) throw new NotFoundError(`Transacción ${id} no encontrada`);

  const tipo = datos.tipo ?? actual.tipo;

  let cuentaId = actual.cuenta_id;
  let metaId = actual.meta_id;

  if (datos.cuentaId !== undefined || datos.metaId !== undefined) {
    const destino = await validarDestino(usuarioId, datos.cuentaId, datos.metaId);
    cuentaId = destino.cuentaId > 0 ? destino.cuentaId : null;
    metaId = destino.metaId > 0 ? destino.metaId : null;
  }

  const montoOriginal = datos.montoOriginal ?? toNumber(actual.monto_original);
  if (montoOriginal <= 0) {
    throw new BadRequestError('El monto original debe ser mayor a 0');
  }

  const { moneda, tasa } = validarMoneda(datos.monedaOriginal ?? actual.moneda_original, datos.tasaCambioUsada ?? toNumber(actual.tasa_cambio_usada));
  const montoGtq = construirMonto(moneda, tasa, montoOriginal);

  await aplicarEfecto(
    usuarioId,
    { cuentaId: actual.cuenta_id ?? -1, metaId: actual.meta_id ?? -1 },
    actual.tipo,
    toNumber(actual.monto_gtq) * -1,
  );

  await aplicarEfecto(usuarioId, { cuentaId: cuentaId ?? -1, metaId: metaId ?? -1 }, tipo, montoGtq);

  const row = await transaccionModel.update(id, {
    nombre: datos.nombre,
    tipo: datos.tipo,
    cuentaId: datos.cuentaId !== undefined ? cuentaId : undefined,
    metaId: datos.metaId !== undefined ? metaId : undefined,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    montoOriginal: datos.montoOriginal !== undefined ? montoOriginal : undefined,
    monedaOriginal: datos.monedaOriginal !== undefined ? moneda : undefined,
    tasaCambioUsada: datos.tasaCambioUsada !== undefined ? tasa : undefined,
    montoGtq: (datos.montoOriginal !== undefined || datos.monedaOriginal !== undefined || datos.tasaCambioUsada !== undefined) ? montoGtq : undefined,
  });

  return toTransaccionPublica(row as transaccionModel.TransaccionRow);
}

export async function eliminar(usuarioId: number, id: number): Promise<void> {
  const actual = await transaccionModel.findByIdAndUsuario(usuarioId, id);
  if (!actual) throw new NotFoundError(`Transacción ${id} no encontrada`);

  const montoGtq = toNumber(actual.monto_gtq);
  await aplicarEfecto(
    usuarioId,
    { cuentaId: actual.cuenta_id ?? -1, metaId: actual.meta_id ?? -1 },
    actual.tipo,
    montoGtq * -1,
  );

  await transaccionModel.remove(id);
}