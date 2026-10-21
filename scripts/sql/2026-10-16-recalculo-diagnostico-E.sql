-- Cambio 4, paso 3a bis: qué preguntas sin responder hacen que un área hoy terminada (A o D)
-- pase a "en progreso" con el recálculo. SOLO LEE. Una sola sentencia.
-- Una fila por (sala, área, pauta, pregunta): en cuántas áreas falta esa respuesta y desde cuándo son esas evaluaciones.
with partes as (
  select ea.id as area_eval_id, ea.estado_id as estado_actual, e.sala_id, ea.area_id, e.fecha_creacion,
         p.id as pregunta_id, p.numero, p.titulo, p.activa, p.version,
         coalesce(p.numero::text, 'Q:' || p.id) as grupo, coalesce(p.puntaje, 1) as valor, p.minimo_aprobacion,
         r.respuesta,
         case when coalesce(p.puntaje_invertido, false) then r.respuesta = 0 else r.respuesta = 1 end as correcta
  from evaluaciones_estudiante_area ea
  join evaluaciones_estudiante e on e.id = ea.evaluacion_estudiante_id
  join preguntas p on p.sala_id = e.sala_id and p.area_id = ea.area_id and p.activa is distinct from false
  left join evaluaciones_estudiante_area_preguntas r on r.evaluaciones_area_id = ea.id and r.pregunta_id = p.id
  where ea.estado_id in ('A', 'D')
),
incompletas as (
  select area_eval_id from partes group by 1 having bool_or(respuesta is null)
)
select pa.sala_id, pa.area_id, pa.numero, pa.titulo, pa.activa, pa.version,
       count(*) as areas_sin_esta_respuesta,
       min(pa.fecha_creacion)::date as evaluacion_mas_vieja, max(pa.fecha_creacion)::date as evaluacion_mas_nueva,
       (select count(*) from incompletas) as total_areas_que_pasan_a_e
from partes pa
join incompletas i on i.area_eval_id = pa.area_eval_id
where pa.respuesta is null
group by 1, 2, 3, 4, 5, 6
order by 1, 2, 3;
