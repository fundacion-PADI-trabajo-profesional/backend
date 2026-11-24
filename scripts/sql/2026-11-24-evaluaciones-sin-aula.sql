-- 2026-11-24 · SÓLO LECTURA. Evaluaciones sin aula cargada: ¿se les puede deducir el aula del alumno?
-- Una fila por evaluación sin aula. Sin nombres ni DNI.
--   aulas_en_la_fecha : aulas en las que el alumno estaba asignado el día de la evaluación
--   aulas_activas_hoy : aulas en las que está asignado hoy
--   caso              : qué se podría hacer con esa evaluación
select left(e.id::text, 8)            as evaluacion,
       e.fecha_creacion::date         as fecha,
       e.tipo_id                      as tipo,
       e.sala_id                      as sala,
       left(e.profesor_id::text, 8)   as creada_por,
       f.n                            as aulas_en_la_fecha,
       h.n                            as aulas_activas_hoy,
       case
         when f.n = 1 then 'A: un aula en la fecha -> asignable'
         when f.n = 0 and h.n = 1 then 'B: sin aula en la fecha, una hoy -> asignable (revisar)'
         when f.n > 1 or h.n > 1 then 'C: mas de un aula -> decidir a mano'
         else 'D: el alumno no tiene aula -> no hay que asignar'
       end                            as caso
from evaluaciones_estudiante e
cross join lateral (
  select count(distinct ea.aula_id) as n
  from "_EstudiantesToAulas" ea
  where ea.estudiante_id = e.estudiante_id
    and ea.fecha_inicio <= e.fecha_creacion
    and (ea.fecha_fin is null or ea.fecha_fin > e.fecha_creacion)
) f
cross join lateral (
  select count(distinct ea.aula_id) as n
  from "_EstudiantesToAulas" ea
  where ea.estudiante_id = e.estudiante_id
    and ea.fecha_fin is null
) h
where e.aula_id is null
order by caso, fecha;
