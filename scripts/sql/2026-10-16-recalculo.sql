-- Cambio 4, paso 3b: aplica el recálculo (correr después de revisar el dry run). Una sola sentencia.
-- Solo áreas que quedan completas con el catálogo actual (ver CTE `aplicables`).
-- Devuelve cuántas áreas y cuántas evaluaciones cambiaron.
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
aplicables as (
  -- Política (Nish, 16/10): no se toca un área que pasaría a "en progreso" (le falta alguna
  -- respuesta según el catálogo actual); conserva su estado y puntaje hasta que alguien la abra.
  -- Para incluirlas, sacar el where.
  select * from nuevo where estado_nuevo <> 'E'
),
estados as (
  -- estado de cada área de cada evaluación después del cambio
  select ea.evaluacion_estudiante_id, coalesce(n.estado_nuevo, ea.estado_id) as estado
  from evaluaciones_estudiante_area ea
  left join aplicables n on n.area_eval_id = ea.id
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
    and exists (select 1 from aplicables n where n.evaluacion_estudiante_id = es.evaluacion_estudiante_id and n.estado_nuevo <> n.estado_actual)
  group by 1, 2
),
upd_areas as (
  update evaluaciones_estudiante_area ea
  set estado_id = n.estado_nuevo, puntaje = n.puntaje
  from aplicables n
  where ea.id = n.area_eval_id and (ea.estado_id <> n.estado_nuevo or ea.puntaje is distinct from n.puntaje)
  returning ea.id
),
upd_evals as (
  update evaluaciones_estudiante e
  set estado_id = x.estado_nuevo
  from eval_nuevo x
  where e.id = x.evaluacion_estudiante_id and e.estado_id <> x.estado_nuevo
  returning e.id
)
select (select count(*) from upd_areas) as areas_actualizadas,
       (select count(*) from upd_evals) as evaluaciones_actualizadas;
