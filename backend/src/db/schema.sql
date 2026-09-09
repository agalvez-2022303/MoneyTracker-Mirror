-- Money Tracker - schema base
-- Se ejecuta de forma idempotente (CREATE TABLE IF NOT EXISTS) en cada arranque.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  rol           TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migración idempotente para tablas existentes con password_hash NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios'
      AND column_name = 'password_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cuentas (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('efectivo', 'tarjeta', 'cripto', 'otro')),
  descripcion   TEXT,
  monto_actual  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  cantidad_objetivo NUMERIC(14, 2) NOT NULL,
  monto_inicial     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  prioridad         TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  descripcion       TEXT,
  icono             TEXT,
  fecha_limite      DATE,
  monto_actual      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transacciones (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  cuenta_id         INTEGER REFERENCES cuentas(id) ON DELETE SET NULL,
  meta_id           INTEGER REFERENCES metas(id) ON DELETE SET NULL,
  categoria         TEXT NOT NULL DEFAULT 'otro',
  descripcion       TEXT,
  monto_original    NUMERIC(14, 2) NOT NULL,
  moneda_original   TEXT NOT NULL DEFAULT 'GTQ',
  tasa_cambio_usada NUMERIC(20, 8) NOT NULL DEFAULT 1,
  monto_gtq         NUMERIC(14, 2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones de refresh token: permiten invalidar sesiones (logout) y controlar inactividad.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_usuario ON cuentas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_metas_usuario ON metas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_cuenta ON transacciones(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_meta ON transacciones(meta_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);