# Mínimo de aprobación por pauta (cambio 4)

Fecha: 2026-10-16. Confirmado por Ceci vía Nish: "el template está bien" y se
recalcula lo ya evaluado. Template: `TEMPLATE Listado de preguntas mayo 2026.xlsx`.

## Problema

La app aprueba una pauta con partes cuando las correctas llegan a la mitad
redondeada hacia arriba (`Math.ceil(total / 2)`), en tres lugares del backend
(`calculateAreaScore`, `getEvaluacionById` con la regla inline, el reporte de
escuela) y uno del frontend (`estadoPauta`). El cuadernillo fija un mínimo
propio por pauta, y en 5 pautas difiere:

| Pauta | Hoy | Cuadernillo |
|---|---|---|
| Intrusos sala 5 (3 partes) | 2 | 3 |
| Copiado de figuras sala 4 y 5 (4) | 2 | 3 |
| Responde a preguntas sala 4 (4) | 2 | 3 |
| Nombra objetos sala 4 (4) | 2 | 3 |
| Absurdo verbal sala 5 (5) | 3 | 4 |

Coinciden: Intrusos sala 4 (2 de 3), Copiado sala 3 (2 de 3), Sonido inicial (3 de 5).

Además, en sala 3 Comunicación y Lenguaje tres preguntas comparten `numero = 1`
("Comunicación de Necesidades", "Uso de Lenguaje", "Uso de frases completas"):
la app las trata como una pauta de 3 partes y el área aprueba con 3 de 4. En el
cuadernillo son las pautas 1, 2 y 3; el área tiene 6 y aprueba con 5 de 6.

## Decisión

- El mínimo vive en los datos: columna `preguntas.minimo_aprobacion`
  (smallint, nulo). Todas las partes de una pauta llevan el mismo valor. Nulo
  = regla de antes (mitad redondeada arriba), así las pautas simples y
  cualquier pauta sin valor siguen igual.
- Una sola función de dominio por repo (`apruebaPauta` con `minimo`,
  `minimoPauta`, `minimoDePartes`) y los tres lugares del backend la usan;
  se elimina la copia inline de `getEvaluacionById`.
- Si las partes trajeran valores distintos, se usa el más alto.
- Sala 3 CL se renumera 1..6 según el cuadernillo y `reglas_aprobacion`
  (sala 3, CL) pasa a 5 de 6.
- El recálculo de lo ya evaluado se hace en SQL (una sentencia), con una
  consulta previa de "qué cambiaría" (dry run). No un endpoint: no hay
  credenciales de prod locales, y un endpoint que itere todas las
  evaluaciones se pasa del timeout de la función.

## Cambios

### Backend (`feat/minimo-aprobacion-pauta`)
1. `prisma/schema.prisma`: `minimo_aprobacion Int? @db.SmallInt` en `Preguntas`.
2. `src/utils/pautas.ts`: `minimoPauta`, `apruebaPauta({ total, correctas, minimo? })`,
   `minimoDePartes`. Tests en `test/utils/pautas.test.ts`.
3. `evaluacion.repository.ts`:
   - `calculateAreaScore`: el select de preguntas trae `minimo_aprobacion`; el
     grupo acumula los mínimos y aprueba con `apruebaPauta`.
   - `getEvaluacionById`: ídem, y usa `esRespuestaCorrecta`/`apruebaPauta` en
     vez de la copia inline.
   - `getPreguntasArea` ya devuelve `...p`, así que el campo llega al frontend.
4. Reporte de escuela: `reporte-escuela.repository.ts` selecciona
   `minimo_aprobacion`; `RespuestaReporteRow.preguntas.minimo_aprobacion`;
   `agruparPautas` del calc acumula el mínimo. Test en `reporte-escuela.calc.test.ts`.
5. `swagger.yaml`: campo en el esquema de pregunta.
6. Scripts SQL en `scripts/sql/` (los corre Nish en Supabase, en este orden):
   - `2026-10-16-minimo-aprobacion.sql`: alter table + mínimos del template +
     renumerado sala 3 CL + regla 5/6. **Antes de mergear el backend** (Prisma
     seleccionaría una columna inexistente).
   - `2026-10-16-recalculo-dry-run.sql`: cuántas áreas cambian de estado (A→D,
     D→A, A/D→E) y cuántas evaluaciones. Solo lee.
   - `2026-10-16-recalculo.sql`: aplica. Replica `calculateAreaScore` y
     `computeEvaluacionEstadoFromAreas` en SQL: por área completada (estado A o
     D), grupos por `numero` de las preguntas activas de la sala/área, correcta
     según `puntaje_invertido`, valor del grupo = `puntaje` (1), puntaje del área
     = suma de los grupos aprobados, umbral = `reglas_aprobacion.aprueba_con` (o
     60 % del total). Estado de la evaluación: N si todas N, E si alguna E o no
     todas finales, A si todas A, si no D. No toca evaluaciones en otros estados.

### Frontend (`feat/minimo-aprobacion-pauta`)
7. `PreguntaBase.minimo_aprobacion?: number | null`.
8. `estadoPauta`: `necesarias = minimoDePartes(partes) ?? Math.ceil(total / 2)`.
   El chip "Se aprueba con X de Y" y la revisión ya leen `necesarias`.

### ADR
9. `documentacion-ADR/0018-minimo-de-aprobacion-por-pauta-en-datos.md` + índice.

## Orden de salida a prod
1. SQL `minimo-aprobacion` (columna + valores + sala 3).
2. Merge backend (deploy automático) y merge frontend.
3. SQL dry run → revisar números con Nish → SQL recálculo.

## Consecuencias
- Resultados ya mostrados a las escuelas pueden cambiar (Ceci lo aceptó).
- Sala 3 CL: las evaluaciones viejas quedan con 6 pautas; las respuestas no
  cambian, solo la agrupación y la regla.
