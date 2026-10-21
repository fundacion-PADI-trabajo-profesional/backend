-- Cambio 4, paso 3a: qué cambiaría el recálculo. SOLO LEE. Una sola sentencia.
-- Filas 'area': por sala/área, cuántas áreas pasan de estado_actual a estado_nuevo (y cuántas cambian de puntaje).
-- Filas 'evaluacion': cuántas evaluaciones cambian de estado (solo las que tienen un área que cambia).
-- Lo esperable: A->D en algunas (mínimos nuevos y sala 3 CL). A/D->E son áreas que el código viejo dio por
-- terminadas con alguna parte de una pauta sin responder (el wizard guarda solo las partes tocadas); desde
-- este cambio el backend las considera en progreso, y el evaluador tiene que completar esas partes.
with partes as (
  -- cada pregunta activa de la sala/área de cada área ya completada (estado A o D), con su respuesta si la hay
  select ea.id as area_eval_id, ea.evaluacion_estudiante_id, ea.estado_id as estado_actual, ea.puntaje as puntaje_actual,
         e.sala_id, ea.area_id,
         coalesce(p.numero::text, 'Q:' || p.id) as grupo, coalesce(p.puntaje, 1) as valor, p.minimo_aprobacion,
         r.respuesta,
         case when coalesce(p.puntaje_invertido, false) then r.respuesta = 0 else r.respuesta = 1 end as correcta
  from evaluaciones_estudiante_area ea
  join evaluaciones_estudiante e on e.id = ea.evaluacion_estudiante_id
  join preguntas p on p.sala_id = e.sala_id and p.area_id = ea.area_id and p.activa is distinct from false
  left join evaluaciones_estudiante_area_preguntas r on r.evaluaciones_area_id = ea.id and r.pregunta_id = p.id
  where ea.estado_id in ('A', 'D')
),
grupos as (
  -- una pauta = las preguntas con el mismo numero; aprueba con el mínimo cargado o la mitad redondeada arriba
  select area_eval_id, evaluacion_estudiante_id, estado_actual, puntaje_actual, sala_id, area_id, grupo,
         count(*) as total, count(respuesta) as respondidas, count(*) filter (where correcta) as correctas,
         max(valor) as valor, max(minimo_aprobacion) as minimo
  from partes
  group by 1, 2, 3, 4, 5, 6, 7
),
areas as (
  select area_eval_id, evaluacion_estudiante_id, estado_actual, puntaje_actual, sala_id, area_id,
         bool_and(respondidas = total) as completa,
         sum(valor) as total_puntos,
         coalesce(sum(valor) filter (where correctas >= coalesce(minimo, ceil(total / 2.0))), 0) as puntaje
  from grupos
  group by 1, 2, 3, 4, 5, 6
),
nuevo as (
  -- umbral del área: reglas_aprobacion.aprueba_con o el 60 % del total
  select a.*,
         case when not a.completa then 'E'
              when a.puntaje >= coalesce(ra.aprueba_con, ceil(coalesce(ra.puntaje_total, a.total_puntos) * 0.6)) then 'A'
              else 'D' end as estado_nuevo
  from areas a
  left join reglas_aprobacion ra on ra.sala_id = a.sala_id and ra.area_id = a.area_id
),
estados as (
  -- estado de cada área de cada evaluación después del cambio
  select ea.evaluacion_estudiante_id, coalesce(n.estado_nuevo, ea.estado_id) as estado
  from evaluaciones_estudiante_area ea
  left join nuevo n on n.area_eval_id = ea.id
),
eval_nuevo as (
  -- misma regla que computeEvaluacionEstadoFromAreas
  select es.evaluacion_estudiante_id, e.estado_id as estado_actual,
         case when bool_and(es.estado = 'N') then 'N'
              when bool_or(es.estado = 'E') then 'E'
              when not bool_and(es.estado in ('A', 'D')) then 'E'
              when bool_and(es.estado = 'A') then 'A'
              else 'D' end as estado_nuevo
  from estados es
  join evaluaciones_estudiante e on e.id = es.evaluacion_estudiante_id
  where e.estado_id in ('N', 'E', 'A', 'D')
    and exists (select 1 from nuevo n where n.evaluacion_estudiante_id = es.evaluacion_estudiante_id and n.estado_nuevo <> n.estado_actual)
  group by 1, 2
)
select 'area' as nivel, sala_id, area_id, estado_actual, estado_nuevo, count(*) as cantidad,
       count(*) filter (where puntaje_actual is distinct from puntaje) as cambia_puntaje
from nuevo
group by 1, 2, 3, 4, 5
union all
select 'evaluacion', null::smallint, null::text, estado_actual, estado_nuevo, count(*), 0::bigint
from eval_nuevo
where estado_actual <> estado_nuevo
group by 1, 2, 3, 4, 5
order by 1, 2, 3, 4, 5;
