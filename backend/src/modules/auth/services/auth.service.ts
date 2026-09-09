import bcrypt from 'bcrypt';
import * as usuariosService from '../../usuarios/services/usuarios.service';
import * as refreshTokenModel from '../models/refreshToken.model';
import {
  firmaAccessToken,
  generarRefreshToken,
  hashRefreshToken,
} from './token.service';
import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';

export interface ResultadoSesion {
  accessToken: string;
  refreshToken: string;
}

export interface ResultadoLogin extends ResultadoSesion {
  usuario: usuariosService.UsuarioPublico;
}

export async function login(email: string, password: string): Promise<ResultadoLogin> {
  const usuario = await usuariosService.obtenerPorEmail(email);
  if (!usuario || !usuario.password_hash) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  return iniciarSesion(usuariosService.toUsuarioPublico(usuario));
}

export async function iniciarSesion(usuario: usuariosService.UsuarioPublico): Promise<ResultadoLogin> {
  return {
    usuario,
    accessToken: firmaAccessToken({ id: usuario.id, rol: usuario.rol }),
    refreshToken: await crearRefreshToken(usuario.id),
  };
}

async function crearRefreshToken(usuarioId: number): Promise<string> {
  const rawToken = generarRefreshToken();
  const expiresAt = new Date(Date.now() + env.auth.refreshTokenHours * 60 * 60 * 1000);
  await refreshTokenModel.create({
    usuarioId,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt,
  });
  return rawToken;
}

export async function refresh(rawRefreshToken: string | undefined): Promise<ResultadoSesion> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token no encontrado');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const sesion = await refreshTokenModel.findByHash(tokenHash);
  if (!sesion) {
    throw new UnauthorizedError('Sesión inválida');
  }

  const ahora = Date.now();

  if (sesion.expires_at.getTime() <= ahora) {
    await refreshTokenModel.removeByHash(tokenHash);
    throw new UnauthorizedError('La sesión expiró');
  }

  const inactividadMs = ahora - sesion.last_used_at.getTime();
  if (inactividadMs > env.auth.sessionIdleHours * 60 * 60 * 1000) {
    await refreshTokenModel.removeByHash(tokenHash);
    throw new UnauthorizedError('Sesión inactiva por más de 3 horas');
  }

  const usuario = await usuariosService.obtenerPorId(sesion.usuario_id);
  await refreshTokenModel.removeByHash(tokenHash);
  const nuevoRefreshToken = await crearRefreshToken(usuario.id);

  return {
    accessToken: firmaAccessToken({ id: usuario.id, rol: usuario.rol }),
    refreshToken: nuevoRefreshToken,
  };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  await refreshTokenModel.removeByHash(hashRefreshToken(rawRefreshToken));
}