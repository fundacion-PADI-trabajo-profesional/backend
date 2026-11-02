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
- Reporte de escuela (`reporte-escuela.calc.ts`): arma `inicialPorEst` y `cierrePorEst` como
  `Map` por alumno. Con dos iniciales del mismo alumno se queda con la última y pisa la otra en
  silencio; el comparativo inicial→cierre y "cierra con" salen mal. Las estadísticas filtran por
  `tipo` y `periodo` (año de `fecha_creacion`).
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
   editable; cualquier otro campo en el body se ignora). Permisos iguales a borrar: la docente
   solo las suyas (`profesor_id === user.id`), director/encargado/equipo PADI cualquiera
   dentro de su alcance actual. Aplica el mismo freno del punto 1 contra el tipo nuevo.
   Respuestas: `200` con la evaluación (misma forma que `GET /evaluaciones/:id`), `400` tipo
   inválido o duplicado, `403` docente sobre evaluación ajena (`AuthorizationError`, ADR 0014),
   `404` no existe. No cambia puntajes ni respuestas: el tipo es una etiqueta.
3. **Reporte determinista con duplicados.** En `reporte-escuela.calc.ts`, al armar los mapas
   por alumno, quedarse con la inicial **más antigua** y el cierre **más reciente**; dejar un
   `console.warn` con los ids que quedaron afuera. Es defensa: después de la corrección de datos
   no debería haber duplicados, pero el cálculo no debe depender del orden de la consulta.
4. **Corrección de datos de prod** (SQL, la corre Nacho en el SQL editor; no va en código):
   - (a) Iniciales con `fecha_creacion >= 2026-10-01` cuyo alumno ya tenía una inicial anterior
     en la misma sala → pasan a `cierre`. Sin ambigüedad.
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
