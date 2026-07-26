# Gestor de gastos compartidos

Aplicación full-stack para gestionar gastos en grupo (estilo Splitwise): los usuarios crean
grupos, registran gastos indicando quién pagó y entre quiénes se divide, y la app calcula el
balance neto de cada miembro sugiriendo el mínimo número de pagos para saldar las deudas.

## Stack

| Capa          | Tecnología                                                        |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | React 19 + TypeScript (Vite), React Router                        |
| Backend       | Node.js + Express 5 + TypeScript                                  |
| Base de datos | SQLite (`node:sqlite`, integrado en Node), migrable a PostgreSQL  |
| Autenticación | JWT + bcrypt, rate limiting en login                              |
| Calidad       | 79 tests (Vitest + supertest), ESLint type-checked, CI en Actions |

## Puntos técnicos destacados

- **Dinero como enteros en centavos** en toda la aplicación — nunca floats, ni en la BD ni
  en el parseo de formularios ([`money.ts`](client/src/utils/money.ts) usa aritmética de
  strings).
- **Algoritmo de simplificación de deudas** ([`balance.ts`](server/src/services/balance.ts)):
  balance neto por miembro + greedy deudor/acreedor que garantiza ≤ N−1 transferencias.
  Verificado con tests de propiedad sobre 200 escenarios pseudoaleatorios reproducibles.
- **Arquitectura en capas** (routes → controllers → services → repositories): la lógica de
  negocio no conoce Express ni SQL, y migrar de SQLite a PostgreSQL toca una sola capa.
- **Autorización pensada**: 404 (no 403) para recursos de grupos ajenos — no filtrar
  existencia; el emisor de un pago sale del token, nunca del body.
- **Migraciones append-only** escritas a mano, con transacciones y tabla de control.
- Las decisiones técnicas y sus alternativas están documentadas en
  [docs/DESIGN.md](docs/DESIGN.md).

## Estructura

```
├── client/   # SPA en React
│   └── src/
│       ├── api/           # Wrapper de fetch y llamadas tipadas a la API
│       ├── components/    # Componentes compartidos (ProtectedRoute)
│       ├── features/      # Pantallas por dominio: auth, groups, expenses, balances
│       └── utils/         # Dinero (centavos) y fechas de calendario
├── server/   # API REST en Express
│   └── src/
│       ├── routes/        # Definición de endpoints
│       ├── controllers/   # Manejo de request/response + esquemas Zod
│       ├── services/      # Lógica de negocio (algoritmo de balances)
│       ├── repositories/  # Acceso a datos (única capa que toca SQL)
│       ├── middleware/    # Auth JWT, membresía de grupo, validación, errores
│       └── db/            # Conexión y migraciones
└── docs/     # Diseño del sistema
```

## Desarrollo

Requiere Node.js >= 22.5 (usa el módulo `node:sqlite` integrado).

```bash
npm install
cp server/.env.example server/.env   # y completar JWT_SECRET
npm run dev          # API en http://localhost:3001
npm run dev:client   # frontend en http://localhost:5173 (en otra terminal)
```

El frontend en desarrollo usa el proxy de Vite hacia la API: un solo origen, sin CORS.

```bash
npm run test         # 79 tests: API de punta a punta + unitarios de algoritmos
npm run lint         # ESLint (reglas type-checked) en ambos workspaces
npm run build        # compila server y client
```

## Producción

**Uso local en Windows**: doble click en `iniciar.cmd` — compila si hace falta, levanta todo
en un proceso y abre el navegador en http://localhost:3001.

Un solo proceso sirve la API y el frontend compilado:

```bash
npm run build
# en server/.env: CLIENT_DIST=../client/dist
npm start
```

Notas: detrás de un proxy inverso activar `trust proxy`; para migrar a PostgreSQL solo se
reescribe la capa `repositories/` (SQL estándar) y el runner de migraciones.

## Estado del proyecto

- [x] Fase 0 — Setup: monorepo, TypeScript estricto, ESLint + Prettier
- [x] Fase 1 — Esquema de BD, migraciones y autenticación (JWT + bcrypt)
- [x] Fase 2 — Grupos y miembros
- [x] Fase 3 — Gastos con divisiones
- [x] Fase 4 — Algoritmo de balances y simplificación de deudas
- [x] Fase 5 — Frontend: auth y grupos
- [x] Fase 6 — Frontend: gastos y balances
- [x] Fase 7 — Seguridad HTTP, CI, build de producción

### Posibles extensiones

- Divisiones con montos personalizados en la UI (la API y el modelo ya lo soportan)
- Migración a PostgreSQL + despliegue con Docker
- Refresh tokens y revocación de sesión
- Invitaciones por email en lugar de alta directa de miembros
