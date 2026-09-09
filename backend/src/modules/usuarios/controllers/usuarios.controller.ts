import { Request, Response } from 'express';
import * as usuariosService from '../services/usuarios.service';
import { asyncHandler, parsePositiveInt } from '../../../utils/http';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'cliente'];
const NOMBRE_MAX = 60;

function validarEmail(email: unknown): string {
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new BadRequestError('El campo "email" debe ser un correo válido');
  }
  return email.toLowerCase().trim();
}

function validarPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6) {
    throw new BadRequestError('El campo "password" debe tener al menos 6 caracteres');
  }
  return password;
}

function validarNuevoPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6) {
    throw new BadRequestError('La nueva contraseña debe tener al menos 6 caracteres');
  }
  return password;
}

function validarNombre(nombre: unknown): string | undefined {
  if (nombre === undefined || nombre === null || nombre === '') return undefined;
  if (typeof nombre !== 'string') {
    throw new BadRequestError('El campo "nombre" debe ser texto');
  }
  const normalizado = nombre.trim();
  if (normalizado.length === 0) return undefined;
  if (normalizado.length > NOMBRE_MAX) {
    throw new BadRequestError(`El campo "nombre" no puede exceder ${NOMBRE_MAX} caracteres`);
  }
  return normalizado;
}

function validarRol(rol: unknown): 'admin' | 'cliente' | undefined {
  if (rol === undefined || rol === '') return undefined;
  if (typeof rol !== 'string' || !ROLES.includes(rol)) {
    throw new BadRequestError('El campo "rol" debe ser "admin" o "cliente"');
  }
  return rol as 'admin' | 'cliente';
}

function asegurarMismoUsuario(req: Request, id: number): void {
  const reqAuth = req as AuthRequest;
  const autenticado = reqAuth.userId;
  const rol = reqAuth.userRol;
  if (autenticado !== id && rol !== 'admin') {
    throw new ForbiddenError('No puedes modificar la cuenta de otro usuario');
  }
}

export const listar = asyncHandler(async (_req: Request, res: Response) => {
  const usuarios = await usuariosService.listar();
  res.json({ usuarios });
});

export const obtenerPorId = asyncHandler(async (req: Request, res: Response) => {
  const id = parsePositiveInt(req.params.id, 'id');
  const usuario = await usuariosService.obtenerPorId(id);
  res.json({ usuario });
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await usuariosService.crear({
    email: validarEmail(req.body.email),
    password: validarPassword(req.body.password),
    nombre: validarNombre(req.body.nombre),
    rol: validarRol(req.body.rol),
  });
  res.status(201).json({ usuario });
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const id = parsePositiveInt(req.params.id, 'id');
  asegurarMismoUsuario(req, id);
  const usuario = await usuariosService.actualizar(id, {
    email: req.body.email !== undefined ? validarEmail(req.body.email) : undefined,
    password: req.body.password !== undefined ? validarPassword(req.body.password) : undefined,
    rol: validarRol(req.body.rol),
    nombre: validarNombre(req.body.nombre),
  });
  res.json({ usuario });
});

export const eliminar = asyncHandler(async (req: Request, res: Response) => {
  const id = parsePositiveInt(req.params.id, 'id');
  asegurarMismoUsuario(req, id);
  await usuariosService.eliminar(id);
  res.status(204).send();
});

export const obtenerPerfil = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await usuariosService.obtenerPorId((req as AuthRequest).userId as number);
  res.json({ usuario });
});

export const actualizarPerfil = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await usuariosService.actualizar((req as AuthRequest).userId as number, {
    email: req.body.email !== undefined ? validarEmail(req.body.email) : undefined,
    nombre: validarNombre(req.body.nombre),
  });
  res.json({ usuario });
});

export const cambiarPassword = asyncHandler(async (req: Request, res: Response) => {
  const passwordActual = req.body.passwordActual;
  const nuevaPassword = validarNuevoPassword(req.body.nuevaPassword);
  await usuariosService.cambiarPassword(
    (req as AuthRequest).userId as number,
    typeof passwordActual === 'string' && passwordActual.length > 0 ? passwordActual : undefined,
    nuevaPassword,
  );
  res.json({ ok: true });
});

export const exportarDatos = asyncHandler(async (req: Request, res: Response) => {
  const datos = await usuariosService.exportarDatos((req as AuthRequest).userId as number);
  res.json(datos);
});