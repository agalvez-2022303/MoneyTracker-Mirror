import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_VARS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PG_DATABASE', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(`Variable de entorno faltante: ${key}. Revisa tu archivo .env`);
  }
}

function parseIntEnv(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseIntEnv('PORT', 4000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:3000',
  db: {
    host: process.env.PGHOST as string,
    port: parseIntEnv('PGPORT', 5432),
    user: process.env.PGUSER as string,
    password: process.env.PGPASSWORD as string,
    database: process.env.PG_DATABASE as string,
  },
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  },
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTokenMinutes: parseIntEnv('ACCESS_TOKEN_MINUTES', 15),
    refreshTokenHours: parseIntEnv('REFRESH_TOKEN_HOURS', 9),
    sessionIdleHours: parseIntEnv('SESSION_IDLE_HOURS', 3),
  },
};