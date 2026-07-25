# Diseño del sistema

Documento de diseño previo a la implementación. Registra las decisiones técnicas y sus
alternativas consideradas.

## 1. Arquitectura general

Monorepo con `client/` (React SPA) y `server/` (API REST en Express). Se eligió monorepo sobre
repositorios separados para simplificar la revisión del proyecto y compartir tipos TypeScript
entre frontend y backend.

El backend usa arquitectura en capas:

```
routes → controllers → services → repositories → SQLite
```

- **routes**: mapean URLs y verbos HTTP a controllers. Sin lógica.
- **controllers**: parsean el request, invocan servicios, arman la respuesta HTTP.
- **services**: lógica de negocio pura (validaciones de dominio, algoritmo de balances).
  No conocen Express ni SQL, por lo que se testean de forma aislada.
- **repositories**: única capa que ejecuta SQL. Migrar de SQLite a PostgreSQL solo
  requiere tocar esta capa.

## 2. Modelo de datos

```
users:          id, email (unique), password_hash, name, created_at
groups:         id, name, created_by → users, created_at
group_members:  group_id → groups, user_id → users, joined_at   (PK compuesta, N:M)
expenses:       id, group_id → groups, paid_by → users, description,
                amount_cents, expense_date, created_at
expense_splits: expense_id → expenses, user_id → users, amount_cents  (PK compuesta)
settlements:    id, group_id → groups, from_user → users, to_user → users,
                amount_cents, created_at
```

### Decisiones

**Dinero como enteros en centavos.** Los floats acumulan errores de redondeo
(`0.1 + 0.2 !== 0.3`) y SQLite no tiene un tipo DECIMAL real. Todos los montos se guardan
como enteros en la unidad mínima ($150.50 → `15050`), el mismo enfoque que usa Stripe.

**Splits con montos explícitos.** `expense_splits` guarda el monto exacto que le corresponde
a cada participante en lugar de recalcular "monto / N" al vuelo. Esto soporta divisiones
desiguales y deja registrado quién absorbe el centavo sobrante cuando la división no es exacta.
Invariante validada en el servicio: `SUM(splits.amount_cents) === expense.amount_cents`.

**Balances calculados, no almacenados.** No existe tabla `balances`: se derivan de
`expenses + expense_splits + settlements` en cada consulta. Una tabla de balances duplicaría
información y podría quedar inconsistente; a esta escala el cálculo al vuelo es instantáneo.
Si el volumen creciera, se agregaría caché por grupo con invalidación al escribir.

**Settlements como tabla propia.** Un pago entre dos personas es conceptualmente distinto de
un gasto compartido; modelarlo como "gasto especial" complicaría el algoritmo de balances.

## 3. API REST

Autenticación stateless con JWT (header `Authorization: Bearer <token>`). Contraseñas
hasheadas con bcrypt. Trade-off conocido: un JWT no puede revocarse antes de expirar; se
mitiga con expiración corta.

```
POST   /api/auth/register              { email, name, password }
POST   /api/auth/login                 { email, password } → { token }
GET    /api/auth/me

POST   /api/groups                     { name }
GET    /api/groups
GET    /api/groups/:id
POST   /api/groups/:id/members         { email }
DELETE /api/groups/:id/members/:userId

POST   /api/groups/:id/expenses        { description, amountCents, paidBy, expenseDate?,
                                          splits | splitAmong }
GET    /api/groups/:id/expenses
DELETE /api/groups/:id/expenses/:expenseId

GET    /api/groups/:id/balances        → { balances, suggestedSettlements }
POST   /api/groups/:id/settlements     { toUser, amountCents }
```

Autorización transversal (middleware): solo los miembros de un grupo acceden a sus recursos.

Al crear un gasto se indica exactamente una forma de dividirlo: `splits` (lista explícita de
`{ userId, amountCents }`, debe sumar el monto) o `splitAmong` (lista de userIds; el servidor
divide en partes iguales). La regla del redondeo vive en el servidor: los primeros
`monto % n` participantes en orden ascendente de userId absorben un centavo extra, de forma
determinista. Si la calculara cada cliente, dos clientes podrían repartir distinto el mismo
gasto.

## 4. Algoritmo de simplificación de deudas

1. Calcular el balance neto de cada miembro: `pagado − consumido − pagos_enviados + pagos_recibidos`.
   La suma de todos los balances es siempre 0.
2. Algoritmo greedy: emparejar repetidamente al mayor deudor con el mayor acreedor y saldar
   el mínimo de los dos montos.

Garantiza a lo sumo `N − 1` transacciones para `N` miembros. Minimizar el número absoluto de
transacciones es NP-difícil (equivale a particionar en subconjuntos de suma cero); el greedy
es el estándar práctico y el que usan las apps reales.

## 5. Fases de construcción

| Fase | Alcance                                            |
| ---- | -------------------------------------------------- |
| 0    | Setup: monorepo, TS estricto, ESLint + Prettier    |
| 1    | Esquema de BD, migraciones, registro/login con JWT |
| 2    | Grupos y miembros (API + tests)                    |
| 3    | Gastos con splits y validaciones                   |
| 4    | Algoritmo de balances + tests unitarios            |
| 5    | Frontend: auth y grupos                            |
| 6    | Frontend: gastos y balances                        |
| 7    | Manejo de errores, CI, deploy, README final        |

Decisiones de alcance: se parte con división en partes iguales (el modelo ya soporta montos
personalizados para una fase futura) y con SQL escrito a mano en lugar de un ORM, para
mantener visibilidad total sobre las consultas.

**Driver de SQLite: `node:sqlite` (módulo integrado de Node >= 22.5).** La opción inicial era
`better-sqlite3`, pero es un módulo nativo que requiere binarios precompilados o una toolchain
de compilación (Python + build tools) cuando no hay prebuild para la versión de Node. El módulo
integrado ofrece la misma API síncrona de statements preparados, elimina la dependencia y
habilita las foreign keys por defecto. El trade-off: es más reciente y tiene menos ecosistema
alrededor, pero para este proyecto la superficie usada (prepare/run/get/all/exec) es idéntica.
