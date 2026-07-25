# Gestor de gastos compartidos

Aplicación full-stack para gestionar gastos en grupo (estilo Splitwise): los usuarios crean
grupos, registran gastos indicando quién pagó y entre quiénes se divide, y la app calcula el
balance neto de cada miembro sugiriendo el mínimo número de pagos para saldar las deudas.

## Stack

| Capa          | Tecnología                                      |
| ------------- | ----------------------------------------------- |
| Frontend      | React + TypeScript (Vite)                       |
| Backend       | Node.js + Express + TypeScript                  |
| Base de datos | SQLite (`node:sqlite`, integrado en Node), migrable a PostgreSQL |
| Autenticación | JWT + bcrypt                                    |

## Estructura

```
├── client/   # SPA en React
│   └── src/
│       ├── api/           # Wrapper de fetch y llamadas tipadas a la API
│       ├── components/    # Componentes compartidos (ProtectedRoute)
│       └── features/      # Pantallas por dominio: auth, groups
├── server/   # API REST en Express
│   └── src/
│       ├── routes/        # Definición de endpoints
│       ├── controllers/   # Manejo de request/response
│       ├── services/      # Lógica de negocio (algoritmo de balances)
│       ├── repositories/  # Acceso a datos (única capa que toca SQL)
│       ├── middleware/    # Auth, validación, errores
│       └── db/            # Conexión y migraciones
└── docs/     # Diseño y documentación de la API
```

El diseño completo (modelo de datos, endpoints y decisiones técnicas) está en
[docs/DESIGN.md](docs/DESIGN.md).

## Desarrollo

Requiere Node.js >= 20.

```bash
npm install
cp server/.env.example server/.env   # y completar JWT_SECRET
npm run dev          # API en http://localhost:3001
npm run dev:client   # frontend en http://localhost:5173 (en otra terminal)
npm run test         # suite de tests (Vitest + supertest)
npm run lint         # ESLint sobre todos los workspaces
npm run build        # compila TypeScript y el bundle del cliente
```

## Estado del proyecto

- [x] Fase 0 — Setup: monorepo, TypeScript estricto, ESLint + Prettier
- [x] Fase 1 — Esquema de BD, migraciones y autenticación (JWT + bcrypt)
- [x] Fase 2 — Grupos y miembros
- [x] Fase 3 — Gastos con divisiones
- [x] Fase 4 — Algoritmo de balances y simplificación de deudas
- [x] Fase 5 — Frontend: auth y grupos
- [x] Fase 6 — Frontend: gastos y balances
- [ ] Fase 7 — Pulido: CI, deploy, documentación final
