# Tipo de evaluación: evitar iniciales por error y poder corregirlas (backend)

Fecha: 2026-11-02. Pedido de Cecilia (Fundación PADI): "necesitamos un double check de qué
tipo de evaluación estás haciendo, porque aparece por defecto la opción inicial y muchas se
equivocaron; y si se puede, la opción de modificar de inicial a final si te equivocaste".
Estamos en noviembre: casi todo lo que se carga ahora es de cierre.

Spec hermana en el frontend: `frontend/docs/specs/2026-11-02-tipo-evaluacion-por-defecto.md`.

## Qué pasa hoy

- `evaluaciones_estudiante.tipo_id` es `inicial` o `cierre` (tabla `tipos_evaluacion`). Cada
  alumno debería tener como mucho una de cada tipo por sala (grado) y por año.
- `POST /evaluaciones` acepta cualquier `tipo_id` sin mirar el historial del alumno. No hay
  unicidad en la base. El formulario arranca en "Evaluacion Inicial", así que en noviembre
  muchas evaluaciones de cierre quedaron guardadas como iniciales.
- **No existe ningún endpoint para editar una evaluación.** El frontend tiene
  `actualizarEvaluacionInstancia` (PATCH `/evaluaciones/:id`) que nunca se llama y daría 404.
  Solo hay `POST`, `GET`, `GET /:id`, `DELETE /:id` y las de preguntas/respuestas.
- Reporte de escuela (`reporte-escuela.calc.ts`): deduplica por alumno y tipo quedándose con
  la más reciente (decisión con test). Con una inicial de marzo y un "inicial" de octubre que en
  realidad es cierre, el reporte cuenta la de octubre como inicial y no ve cierre: el comparativo
  inicial→cierre sale mal hasta corregir los datos. Las estadísticas filtran por `tipo` y
  `periodo` (año de `fecha_creacion`).
- `GET /evaluaciones` para una docente devuelve las evaluaciones de los alumnos de sus aulas
  activas (filtra por `aula_id` de sus aulas); si no tiene aulas, solo las propias. Una
  evaluación cargada sin `aula_id` no le aparece aunque sea de un alumno suyo.
- `DELETE /evaluaciones/:id`: la docente solo puede borrar las suyas; director, encargado y
  equipo PADI, cualquiera (`EvaluacionesService.remove`).

## Decisión

1. **Freno en el alta.** `POST /evaluaciones` rechaza con `400` y `error.code = "TIPO_DUPLICADO"`
   si el alumno ya tiene una evaluación del mismo `tipo_id`, misma `sala_id` y mismo año
   calendario de `fecha_creacion`. Vale para inicial y para cierre. Mensaje para la persona:
   "Este alumno ya tiene una evaluación inicial de sala 4 cargada el 12/03/2026. Si esta es de
   cierre, elegí Cierre; si la anterior está mal, cambiale el tipo o eliminala." El detalle de
   `error` trae `{ code, evaluacion_existente: { id, tipo_id, fecha_creacion } }` para que el
   frontend pueda ofrecer ir a esa evaluación. La verificación se hace en el servicio, como
   admin (`withRLSContextAsAdmin`), porque la evaluación previa puede ser de otra docente.
2. **Cambiar el tipo.** `PATCH /evaluaciones/:id` con body `{ tipo_id }` (único campo
   editable; cualquier otro campo en el body se ignora). Permisos **como la lectura**
   (`GET /evaluaciones/:id`, ADR 0015), no como el borrado: la docente solo las suyas
   (`profesor_id === user.id`); el director solo las de alumnos de su escuela; el encargado
   solo las de escuelas de su zona; equipo PADI cualquiera. La verificación de alcance que hoy
   está copiada en tres controllers se extrae a un helper y el PATCH lo usa. Aplica el mismo
   freno del punto 1 contra el tipo nuevo (excluyendo la propia evaluación). Respuestas: `200`
   con la evaluación (misma forma que `GET /evaluaciones/:id`), `400` tipo inválido o duplicado,
   `403` fuera de alcance (`AuthorizationError`, ADR 0014), `404` no existe. No cambia puntajes
   ni respuestas: el tipo es una etiqueta.
   Nota: `DELETE /evaluaciones/:id` hoy no verifica escuela ni zona (director y encargado
   pueden borrar cualquier evaluación por id). Queda como follow-up, fuera de este alcance.
3. **Reporte: no se toca.** `reporte-escuela.calc.ts` ya deduplica a propósito (`deduplicar()`,
   se queda con la más reciente de cada tipo; test `reporte-escuela.calc.test.ts`). Invertirlo
   movería números en prod sin ganancia una vez corregidos los datos. Se corrige la descripción
   de "Qué pasa hoy": no pisa en silencio, elige la más reciente.
4. **Corrección de datos de prod** (SQL en `documentacion-pruebas/sql/`, escrito por Claude,
   lo corre Nacho en el SQL editor; no va en el repo). **Orden obligatorio: el SQL corre antes
   de mergear el frontend.** Si el frontend nuevo sale antes, a un alumno con [inicial de marzo,
   "inicial" de octubre] la regla por defecto le propone cierre, la docente crea una tercera
   evaluación y, al corregir, quedan dos cierres.
   - (a) Iniciales con `fecha_creacion >= 2026-10-01` cuyo alumno ya tenía una inicial anterior
     en la misma sala **y no tiene cierre en esa sala y año** → pasan a `cierre`. Sin
     ambigüedad. Los que ya tienen cierre van a la lista a revisar (b).
   - (b) Iniciales desde el 1/10 **sin** inicial previa en la misma sala: ambiguas (alumno que
     entró tarde, o inicial que nunca se cargó). Qué hacer lo define Cecilia; si confirma que no
     hubo iniciales legítimas en octubre/noviembre, también pasan a cierre.
   - Antes de cada paso, un `SELECT` con los mismos filtros muestra qué filas se van a tocar; el
     `UPDATE` va en un bloque `DO` atómico con el conteo esperado como precondición.
   - Después del (a)/(b), si no quedan duplicados, se puede agregar un índice único parcial
     `(estudiante_id, sala_id, tipo_id, extract(year from fecha_creacion))` como segunda red.
     Queda fuera de este alcance; se anota como follow-up.
5. **Frontend** (spec hermana): tipo por defecto según el historial del alumno, confirmación
   antes de crear, acción "Cambiar tipo". Usa `GET /evaluaciones?estudianteId=` que ya existe;
   el freno del punto 1 cubre lo que esa consulta no ve (evaluaciones sin `aula_id`).

Orden de deploy: backend primero (el frontend consume el PATCH y el `code` del 400). El
assert del test de contrato sobre la función nueva del frontend va en un PR posterior al del
frontend (gotcha del 30/10).

## Alternativas descartadas

- **Tipo por defecto según el mes** (después de septiembre → cierre): simple, pero se equivoca
  con los alumnos que entran tarde y necesitan una inicial en octubre. La regla por historial
  del alumno no tiene ese problema.
- **Índice único en la base ya**: la base tiene duplicados reales hoy; el índice no se puede crear
  hasta corregirlos. Primero el freno en la app y la corrección; el índice, después.
- **Editar cualquier campo de la evaluación**: solo el tipo tiene un caso de uso real; lo demás
  (alumno, sala) se resuelve borrando y volviendo a crear, como hoy.
- **Corregir "todo lo de octubre" sin mirar el historial**: pisaría iniciales legítimas de
  chicos nuevos. Se separa en (a) seguro y (b) a confirmar.

## Verificación

- Tests de servicio y de ruta: alta rechaza duplicado (inicial y cierre) y acepta distinta sala o
  distinto año; `PATCH` feliz; `403` docente ajena; `400` tipo inválido y duplicado; `404`;
  `calc` con dos iniciales elige la más antigua y con dos cierres el más reciente.
- `npm run build`, `npm run test:coverage` (umbral 70 %), contratos.
- En prod, después del deploy: crear una evaluación de un alumno que ya tiene inicial en la
  misma sala y ver el 400 con el mensaje; cambiar el tipo de una de prueba y verla en el
  historial del alumno.
