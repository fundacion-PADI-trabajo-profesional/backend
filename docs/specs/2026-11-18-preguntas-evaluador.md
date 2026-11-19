# Preguntas para el evaluador — backend (18/11/2026)

Spec completa en `frontend/docs/specs/2026-11-18-preguntas-evaluador.md`; decisiones en ADR 0020.

- Columnas nullable en `evaluaciones_estudiante`: `sesiones_completadas`, `en_tratamiento`, `tiene_cud`, `observaciones`.
  SQL: `scripts/sql/2026-11-18-preguntas-evaluador.sql`. **Correr en producción antes de desplegar**: `findById` usa
  `include` y los listados seleccionan `en_tratamiento`/`tiene_cud`, así que sin las columnas fallan todas las consultas
  de evaluaciones y los listados de alumnos.
- `PUT /evaluaciones/:id/datos-evaluador` (router → `putDatosEvaluador` → `EvaluacionService.guardarDatosEvaluador` →
  `EvaluacionRepository.updateDatosEvaluador`). Validación y regla en `src/utils/datos-evaluador.ts`.
- `contexto_evaluador: { en_tratamiento, tiene_cud }` por alumno en `GET /estudiantes` (los tres listados de
  `estudiante.repository.ts`) y en las aulas del docente (`aula.repository.ts`).
- Tests: `test/datos-evaluador.util.test.ts`, `test/evaluaciones-datos-evaluador.test.ts`, contrato en `test/contracts/`.
- El test de contrato lee `frontend/src/api/evaluaciones.ts` y `frontend/src/utils/datosEvaluador.ts`: mergear el frontend primero.
