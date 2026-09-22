# MoneyTracker

Aplicación web para llevar el control de tus finanzas personales. La idea es simple: registrar tus cuentas, tus metas de ahorro y cada movimiento (ingresos y egresos) para tener una vista clara de donde va tu dinero.

## Versión

**1.0** - Primera versión del programa. Incluye el login, el panel principal con el resumen de dinero, el registro de cuentas, metas y transacciones desde el botón flotante, y el círculo de progreso en el dashboard.

## Tecnologías

- **Frontend:** Angular 22 (standalone, sin zone.js), Tailwind CSS, iconos de Lucide
- **Backend:** Node.js con Express y TypeScript
- **Base de datos:** PostgreSQL

## Requisitos

- Node.js 20 o superior
- PostgreSQL en tu maquina (local o en un contenedor)

## Configuracion

1. Copia el archivo `.env.example` dentro de `backend/` y renombralo como `.env`.
2. Edita las variables de PostgreSQL segun tus credenciales y define los secretos de JWT.
3. Ejecuta el bootstrap de la base de datos para crear las tablas y el usuario admin inicial.

## Como ejecutarlo

**Backend**

```bash
cd backend
npm install
npm run db:bootstrap
npm run dev
```

Queda escuchando en `http://localhost:4000`.

**Frontend**

```bash
cd frontend
npm install
npm run start
```

Abre `http://localhost:4200` en tu navegador.

## Usuario admin
**Dos Usuarios**
El bootstrap crea un usuario administrador con el email y password que definiste en `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Con el puedes iniciar sesion y probar todo el flujo.

## Funciones principales

- Panel con el resumen de tu dinero, ingresos y gastos del mes.
- Metas de ahorro con seguimiento del avance (el círculo de progreso).
- Cuentas de tipo efectivo, tarjeta, cripto u otro.
- Registro de transacciones con varias monedas y conversion a quetzales.
- Botón flotante para crear metas, cuentas y transacciones rapido.
- Opción para ocultar montos por privacidad.

## Notas

- El proyecto esta dividido en `backend/` y `frontend/`.
- El frontend corre en modo "zonasless" (no usa zone.js), por eso el estado se maneja con señales.
