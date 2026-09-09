import { CookieOptions, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as googleAuthService from '../services/google-auth.service';
import { asyncHandler } from '../../../utils/http';
import { BadRequestError } from '../../../utils/errors';
import { env } from '../../../config/env';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function crearOpcionesCookie(maxAgeMs: number, path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path,
    maxAge: maxAgeMs,
  };
}

function opcionesAccessToken(): CookieOptions {
  return crearOpcionesCookie(env.auth.accessTokenMinutes * 60 * 1000, '/');
}

function opcionesRefreshToken(): CookieOptions {
  return crearOpcionesCookie(env.auth.refreshTokenHours * 60 * 60 * 1000, '/api/auth');
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const email = req.body?.email;
  const password = req.body?.password;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new BadRequestError('El campo "email" debe ser un correo válido');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new BadRequestError('El campo "password" es obligatorio');
  }

  const sesion = await authService.login(email.toLowerCase().trim(), password);

  res.cookie('access_token', sesion.accessToken, opcionesAccessToken());
  res.cookie('refresh_token', sesion.refreshToken, opcionesRefreshToken());

  res.json({ usuario: sesion.usuario });
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const idToken = req.body?.idToken;

  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new BadRequestError('El campo "idToken" es obligatorio');
  }

  const sesion = await googleAuthService.loginConGoogle(idToken);

  res.cookie('access_token', sesion.accessToken, opcionesAccessToken());
  res.cookie('refresh_token', sesion.refreshToken, opcionesRefreshToken());

  res.json({ usuario: sesion.usuario });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const sesion = await authService.refresh(req.cookies?.refresh_token);

  res.cookie('access_token', sesion.accessToken, opcionesAccessToken());
  res.cookie('refresh_token', sesion.refreshToken, opcionesRefreshToken());

  res.json({ ok: true });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  await authService.logout(refreshToken);

  res.clearCookie('access_token', opcionesAccessToken());
  res.clearCookie('refresh_token', opcionesRefreshToken());
  res.status(204).send();
});