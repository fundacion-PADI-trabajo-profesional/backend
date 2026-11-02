# Tipo de evaluación: freno de duplicados y `PATCH` de tipo — plan (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /evaluaciones` rechaza una segunda evaluación del mismo tipo para el mismo alumno, sala y año; `PATCH /evaluaciones/:id` permite cambiar solo el `tipo_id` con permisos por alcance.

**Architecture:** Errores tipados en `utils/errors.ts` que los controllers mapean a 400/403/404 (ADR 0014). El chequeo de duplicado vive en el servicio y consulta el repositorio como admin (la evaluación previa puede ser de otra docente). La verificación de escuela/zona de director y encargado, hoy copiada en tres controllers, se extrae a `services/alcance.service.ts` y la usan los tres más el PATCH.

**Tech Stack:** Node 22, Express, TypeScript, Prisma 6, vitest + supertest (`test/helpers/auth-mock.ts`).

**Spec:** `docs/specs/2026-11-02-tipo-evaluacion-cierre.md`

## Global Constraints

- Respuestas siempre con `commonResponse(success, message, data, error)` (ADR 0010). Denegaciones con `AuthorizationError` → 403 (ADR 0014).
- Tipos válidos: `"inicial" | "cierre"`. Código de error de duplicado: `"TIPO_DUPLICADO"`; de tipo inválido: `"TIPO_INVALIDO"`.
- El año se toma de `fecha_creacion` en UTC (`getUTCFullYear()`); el rango del año es `[Date.UTC(anio,0,1), Date.UTC(anio+1,0,1))`.
- Mensaje de duplicado inicial (exacto): `Este alumno ya tiene una evaluación inicial de sala 4 cargada el 12/03/2026. Si esta es de cierre, elegí Cierre; si la anterior está mal, cambiale el tipo o eliminala.` Cierre: `Este alumno ya tiene una evaluación de cierre de sala 4 cargada el 12/03/2026. Si la anterior está mal, cambiale el tipo o eliminala.` Fecha `dd/mm/yyyy` en UTC.
- Toda query nueva al DB va dentro de `withRLSContextAsAdmin` / `withRLSContext` (`src/config/prismaClient.ts`); nada a nivel de módulo.
- No se toca `reporte-escuela.calc.ts` ni `DELETE /evaluaciones/:id`.
- Comandos desde `backend/functions/`: `npx vitest run <archivo>`, `npm run build`, `npm run test:coverage`; contratos con `make test-contracts` desde `backend/`.

## Review Focus

1. `PATCH` con el mismo `tipo_id` que ya tiene la evaluación: debe responder 200 sin tocar la base y sin error de duplicado (la propia evaluación no cuenta). Test en Task 4.
2. `POST`/`PATCH` con `tipo_id` ausente o fuera de la lista: 400 `TIPO_INVALIDO`, no 500 por FK de Postgres. Tests en Task 3 y 4.
3. Alumno con evaluación del mismo tipo en **otra sala** o en **otro año**: no es duplicado. Test del `where` en Task 2.
4. Director sin `escuela_id` o evaluación sin escuela conocida: hoy la lectura deja pasar; el helper conserva ese comportamiento (sin regresión en los 3 endpoints existentes). Test en Task 4 (director con `escuela_id: null` → 200).
5. Docente que tiene el aula asignada pero no creó la evaluación: puede leerla, **no** puede cambiarle el tipo. Test en Task 4.

---

### Task 1: Errores tipados y mensaje de duplicado

**Files:**
- Modify: `src/utils/errors.ts`
- Create: `src/utils/evaluaciones-tipo.ts`
- Test: `test/evaluaciones-tipo.util.test.ts`

**Interfaces:**
- Produces: `class NotFoundError extends Error`, `class ValidationError extends Error { code: string }` (constructor `(message, code)`), `class TipoDuplicadoError extends Error { code = "TIPO_DUPLICADO"; evaluacionExistente: EvaluacionExistente }` (constructor `(message, evaluacionExistente)`), donde `EvaluacionExistente = { id: string; tipo_id: string; fecha_creacion: Date }`.
- Produces en `evaluaciones-tipo.ts`: `TIPOS_EVALUACION = ["inicial", "cierre"] as const`, `type TipoEvaluacion`, `esTipoEvaluacion(v: unknown): v is TipoEvaluacion`, `anioDe(fecha: Date): number`, `rangoAnioUTC(anio: number): { gte: Date; lt: Date }`, `mensajeTipoDuplicado(tipo: TipoEvaluacion, salaId: number, fecha: Date): string`.

- [ ] **Step 1: Test que falla**

```ts
import { anioDe, esTipoEvaluacion, mensajeTipoDuplicado, rangoAnioUTC } from "../src/utils/evaluaciones-tipo";
it("mensaje inicial", () => expect(mensajeTipoDuplicado("inicial", 4, new Date("2026-03-12T00:00:00Z")))
  .toBe("Este alumno ya tiene una evaluación inicial de sala 4 cargada el 12/03/2026. Si esta es de cierre, elegí Cierre; si la anterior está mal, cambiale el tipo o eliminala."));
it("mensaje cierre", () => expect(mensajeTipoDuplicado("cierre", 5, new Date("2026-11-20T00:00:00Z")))
  .toBe("Este alumno ya tiene una evaluación de cierre de sala 5 cargada el 20/11/2026. Si la anterior está mal, cambiale el tipo o eliminala."));
it("año en UTC: 31/12 a las 23:00 UTC sigue siendo 2026", () => expect(anioDe(new Date("2026-12-31T23:00:00Z"))).toBe(2026));
it("rango del año", () => expect(rangoAnioUTC(2026)).toEqual({ gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") }));
it("tipos válidos", () => { expect(esTipoEvaluacion("cierre")).toBe(true); expect(esTipoEvaluacion("final")).toBe(false); expect(esTipoEvaluacion(undefined)).toBe(false); });
```

- [ ] **Step 2: Correr** `npx vitest run test/evaluaciones-tipo.util.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** las clases en `errors.ts` (misma forma que `AuthorizationError`, con `this.name`) y las funciones en `evaluaciones-tipo.ts`. Fecha con `toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })`.
- [ ] **Step 4: Correr** el test → PASS.
- [ ] **Step 5: Commit** `feat(evaluaciones): errores tipados y utilidades de tipo de evaluación`.

### Task 2: Repositorio: buscar duplicado y actualizar tipo

**Files:**
- Modify: `src/repositories/evaluacion.repository.ts` (después de `findActiveEstudianteAula`)
- Test: `test/evaluacion.repository.tipo.test.ts` (patrón de `test/evaluacion.repository.orden.test.ts`: `vi.hoisted` + `vi.mock("../src/config/prismaClient")`)

**Interfaces:**
- Produces: `findDuplicadoTipo(params: { estudianteId: string; salaId: number; tipoId: string; anio: number; excluirId?: string }): Promise<{ id: string; tipo_id: string; fecha_creacion: Date } | null>` y `updateTipo(id: string, tipoId: string): Promise<void>`.

- [ ] **Step 1: Test que falla.** Con un `tx.evaluacionEstudiante.findFirst` que registra sus args y un `update` que registra los suyos:
  - `findDuplicadoTipo({ estudianteId: "s1", salaId: 4, tipoId: "inicial", anio: 2026, excluirId: "ev-1" })` → `findFirst` recibió `where` igual a `{ estudiante_id: "s1", sala_id: 4, tipo_id: "inicial", fecha_creacion: { gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") }, id: { not: "ev-1" } }`, `orderBy: { fecha_creacion: "asc" }`, `select: { id: true, tipo_id: true, fecha_creacion: true }`.
  - sin `excluirId` → `where` no tiene clave `id`.
  - `updateTipo("ev-1", "cierre")` → `update` recibió `{ where: { id: "ev-1" }, data: { tipo_id: "cierre" } }`.
- [ ] **Step 2: Correr** → FAIL (`findDuplicadoTipo is not a function`).
- [ ] **Step 3: Implementar** ambos métodos en el objeto `EvaluacionRepository`, dentro de `withRLSContextAsAdmin`, usando `rangoAnioUTC` de Task 1.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(evaluaciones): repositorio busca duplicado por tipo/sala/año y actualiza tipo`.

### Task 3: Freno de duplicados en el alta

**Files:**
- Modify: `src/services/evaluaciones.service.ts:72-115` (`createEvaluacion`) + método privado nuevo
- Modify: `src/controllers/evaluaciones.controller.ts:17-27` (`createEvaluacion`)
- Modify: `src/interfaces/common-response.interface.ts` (`error` gana `details?: Record<string, unknown>`)
- Test: `test/evaluaciones-tipo.test.ts` (nuevo; patrón de `test/evaluaciones-instancias.test.ts`: `mockAuthAs`, spies sobre `EvaluacionRepository`, `ensureProfesorRecord` mockeado)

**Interfaces:**
- Consumes: `findDuplicadoTipo` (Task 2), `TipoDuplicadoError`, `ValidationError`, `mensajeTipoDuplicado`, `anioDe`, `esTipoEvaluacion` (Task 1).
- Produces: `private async verificarTipoDuplicado(estudianteId: string, salaId: number, tipoId: TipoEvaluacion, fecha: Date, excluirId?: string): Promise<void>` (lanza `TipoDuplicadoError`). Respuesta 400 de duplicado: `commonResponse(false, error.message, null, { code: "TIPO_DUPLICADO", description: error.message, details: { evaluacion_existente: error.evaluacionExistente } })`. Tipo inválido: 400 `{ code: "TIPO_INVALIDO" }`.

- [ ] **Step 1: Tests que fallan** (docente `"docente-1"`, `findEstudianteByDni` → `{ id: "s1", sala_id: 4 }`, body `{ dni: "1", profesor_id: "docente-1", sala_id: 4, tipo_id, fecha_creacion: "2026-11-02" }`):
  - `POST duplicado inicial → 400 TIPO_DUPLICADO`: `findDuplicadoTipo` → `{ id: "ev-prev", tipo_id: "inicial", fecha_creacion: new Date("2026-03-12T00:00:00Z") }`; `res.status` 400; `body.error.code` `"TIPO_DUPLICADO"`; `body.message` contiene `"inicial de sala 4 cargada el 12/03/2026"`; `body.error.details.evaluacion_existente.id` `"ev-prev"`; `create` no llamado.
  - `POST duplicado cierre → mensaje de cierre`: `body.message` contiene `"de cierre de sala 4"`.
  - `POST sin duplicado → 201` y `findDuplicadoTipo` llamado con `{ estudianteId: "s1", salaId: 4, tipoId: "inicial", anio: 2026 }` (sin `excluirId`).
  - `POST tipo_id "final" → 400 TIPO_INVALIDO`, `findDuplicadoTipo` y `create` no llamados.
- [ ] **Step 2: Correr** `npx vitest run test/evaluaciones-tipo.test.ts` → FAIL (`findDuplicadoTipo` no existe como spy / status 201).
- [ ] **Step 3: Implementar.** En el servicio: validar `data.tipo_id` con `esTipoEvaluacion` (si no → `ValidationError("tipo_id inválido: debe ser 'inicial' o 'cierre'", "TIPO_INVALIDO")`); después de resolver `salaId` y antes de `repo.create`, `await this.verificarTipoDuplicado(estudiante.id, salaId, data.tipo_id, new Date(data.fecha_creacion))`. En el controller, `catch`: `TipoDuplicadoError` → 400 con `details`; `ValidationError` → 400 con su `code`; resto como hoy (`CREATE_ERROR`).
- [ ] **Step 4: Correr** el archivo y `npx vitest run test/evaluaciones-instancias.test.ts test/evaluaciones.test.ts` → PASS (los tests viejos de POST no mockean `findDuplicadoTipo`: debe quedar mockeado a `null` en esos o el `withRLSContextAsAdmin` del helper devolver `null`; preferir agregar `vi.spyOn(EvaluacionRepository, "findDuplicadoTipo").mockResolvedValue(null)` donde haga falta).
- [ ] **Step 5: Commit** `feat(evaluaciones): rechazar segunda evaluación del mismo tipo por alumno, sala y año`.

### Task 4: Helper de alcance y `PATCH /evaluaciones/:id`

**Files:**
- Create: `src/services/alcance.service.ts`
- Modify: `src/services/evaluaciones.service.ts` (nuevo `cambiarTipo`)
- Modify: `src/controllers/evaluaciones.controller.ts` (nuevo `patchEvaluacionTipo`; refactor de los bloques director/encargado en `getEvaluacionById`, `getPreguntasDeArea`, `guardarRespuestasArea`)
- Modify: `src/routes/evaluaciones.router.ts:37` (`router.patch("/evaluaciones/:id", patchEvaluacionTipo)`)
- Test: `test/evaluaciones-tipo.test.ts` (mismo archivo, `describe("PATCH /evaluaciones/:id")`)

**Interfaces:**
- Produces: `escuelaEnAlcance(user: { rol: string; escuela_id?: string | null; id: string }, escuelaId: string | null | undefined): Promise<boolean>`. Director: `true` si no tiene `escuela_id`, si `escuelaId` es desconocida o si coinciden. Encargado: `true` si `escuelaId` desconocida o está en las escuelas de su zona (`tx.encargados.findUnique({ where: { usuario_id }, include: { zona: { include: { escuelas: { select: { id: true } } } } } })` dentro de `withRLSContext`). Otros roles: `true`.
- Produces: `cambiarTipo(id: string, tipoId: unknown, user: { id: string; rol: string; escuela_id?: string | null }): Promise<Evaluacion>` → orden: tipo inválido → `ValidationError` TIPO_INVALIDO; `findById` null → `NotFoundError("Evaluación no encontrada")`; docente ajena → `AuthorizationError("No tenés permiso para modificar una evaluación que no creaste.")`; director/encargado fuera de alcance → `AuthorizationError("No tenés permiso para modificar evaluaciones de otra escuela.")`; mismo tipo → devuelve la evaluación sin tocar; duplicado → `TipoDuplicadoError`; si no `updateTipo` y devuelve `findById(id)`.
- Controller mapea: `ValidationError`/`TipoDuplicadoError` → 400 (mismo formato que Task 3), `AuthorizationError` → 403 `{ code: "FORBIDDEN" }`, `NotFoundError` → 404, resto 500. 200: `commonResponse(true, "Tipo de evaluación actualizado", evaluacion)`.

- [ ] **Step 1: Tests que fallan.** `findById` mock base: `{ id: "ev-1", profesor_id: "docente-1", estudiante_id: "s1", sala_id: 4, tipo_id: "inicial", fecha_creacion: new Date("2026-10-20T00:00:00Z"), estudiantes: { escuela_id: "esc-a" } }`; `findDuplicadoTipo` → `null`; `updateTipo` → `undefined`.
  - `equipo_padi cambia a cierre → 200`, `body.data.tipo_id` según segundo `findById` (`mockResolvedValueOnce` dos veces: original y actualizado), `updateTipo` llamado con `("ev-1", "cierre")`, `findDuplicadoTipo` llamado con `expect.objectContaining({ excluirId: "ev-1", tipoId: "cierre", anio: 2026 })`.
  - `docente propia → 200`; `docente ajena (profesor_id "otro") → 403` y `updateTipo` no llamado.
  - `director misma escuela ("esc-a") → 200`; `director otra escuela ("esc-b") → 403`; `director con escuela_id null → 200`.
  - `encargado con zona sin esc-a → 403` (`prismaMock.encargados = { findUnique: vi.fn().mockResolvedValue({ zona: { escuelas: [{ id: "esc-z" }] } }) }`); `encargado con esc-a en su zona → 200`.
  - `tipo_id "final" → 400 TIPO_INVALIDO`; `body sin tipo_id → 400 TIPO_INVALIDO`.
  - `duplicado → 400 TIPO_DUPLICADO` (`findDuplicadoTipo` → `{ id: "ev-c", tipo_id: "cierre", fecha_creacion: ... }`), `updateTipo` no llamado.
  - `mismo tipo ("inicial") → 200` y `updateTipo` y `findDuplicadoTipo` no llamados.
  - `inexistente → 404`.
  - `sin token → 401`.
- [ ] **Step 2: Correr** → FAIL (404 de Express: ruta inexistente).
- [ ] **Step 3: Implementar** `alcance.service.ts`, `cambiarTipo`, `patchEvaluacionTipo`, la ruta. Después reemplazar en los tres controllers existentes los bloques `if (rol === "director" && userEscuelaId) {...}` y `if (rol === "encargado_zona") {...}` por `if (!(await escuelaEnAlcance(req.user!, escuelaEvaluacion))) return 403` conservando el mensaje actual de cada uno. No tocar la rama docente de esos tres.
- [ ] **Step 4: Correr** `npx vitest run test/evaluaciones-tipo.test.ts test/evaluaciones.test.ts test/evaluaciones-instancias.test.ts` → PASS (los tests viejos de 403 director/encargado siguen verdes = refactor sin regresión).
- [ ] **Step 5: Commit** `feat(evaluaciones): PATCH /evaluaciones/:id cambia el tipo con permisos por alcance`.

### Task 5: Swagger, suite completa y PR

**Files:**
- Modify: `../swagger.yaml` (`/evaluaciones/{id}` gana `patch`; `POST /evaluaciones` documenta el 400 `TIPO_DUPLICADO`/`TIPO_INVALIDO`)

- [ ] **Step 1: Swagger.** `patch` con `requestBody` `{ tipo_id: enum [inicial, cierre] }`, respuestas 200 (allOf CommonResponse), 400, 403, 404. Al 400 del POST, descripción con los dos códigos y `error.details.evaluacion_existente`.
- [ ] **Step 2: Verificación completa** desde `backend/functions`: `npm run build` → sin errores; `npm run test:coverage` → todo verde y umbral 70 % cumplido. Desde `backend/`: `make test-contracts` → verde (no se agregan asserts sobre el frontend en este PR; gotcha del 30/10).
- [ ] **Step 3: Commit** `docs(swagger): PATCH /evaluaciones/{id} y códigos de error del alta` y abrir PR a `main` con `gh pr create --repo fundacion-PADI-trabajo-profesional/backend` (no mergear: lo decide Nacho; orden de deploy en la spec).
