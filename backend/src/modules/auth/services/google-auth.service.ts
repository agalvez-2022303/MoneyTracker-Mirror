import { OAuth2Client } from 'google-auth-library';
import * as usuariosService from '../../usuarios/services/usuarios.service';
import * as authService from './auth.service';
import { env } from '../../../config/env';
import { UnauthorizedError } from '../../../utils/errors';

const oauthClient = new OAuth2Client(env.google.clientId, env.google.clientSecret);

async function verificarEmailGoogle(idToken: string): Promise<{ email: string; nombre: string | null }> {
  let payload: { email?: string; email_verified?: boolean; name?: string } | undefined;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError('Token de Google inválido o expirado');
  }

  if (!payload?.email || !payload.email_verified) {
    throw new UnauthorizedError('No se pudo verificar tu cuenta de Google');
  }

  return {
    email: payload.email.toLowerCase().trim(),
    nombre: payload.name?.trim() || null,
  };
}

export async function loginConGoogle(idToken: string): Promise<authService.ResultadoLogin> {
  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new UnauthorizedError('Token de Google inválido');
  }

  const { email, nombre } = await verificarEmailGoogle(idToken);

  let usuario: usuariosService.UsuarioPublico;
  const existente = await usuariosService.obtenerPorEmail(email);
  if (existente) {
    usuario = usuariosService.toUsuarioPublico(existente);
  } else {
    usuario = await usuariosService.crearUsuarioOAuth(email, nombre);
  }

  return authService.iniciarSesion(usuario);
}