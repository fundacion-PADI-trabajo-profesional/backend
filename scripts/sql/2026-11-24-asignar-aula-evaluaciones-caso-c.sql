-- 2026-11-24 · ESCRIBE EN LA BASE. Segundo paso de `asignar-aula-evaluaciones.sql` (caso C).
-- Regla C: el alumno tiene hoy más de un aula activa; si EXACTAMENTE UNA es de la misma sala que la
-- evaluación, se asigna esa. Si coinciden varias o ninguna, no se toca.
-- Usa el mismo registro (`aula_20261124_evaluaciones`), así que el rollback existente también lo deshace.
-- Se puede correr más de una vez. Un solo bloque: o se aplica todo o nada.
do $$
begin
  insert into aula_20261124_evaluaciones (evaluacion_id, aula_id, regla)
  select e.id, c.aula, 'C'
  from evaluaciones_estudiante e
  cross join lateral (
    select count(distinct a.id) as n, (array_agg(a.id))[1] as aula
    from "_EstudiantesToAulas" ea
    join aulas a on a.id = ea.aula_id
    where ea.estudiante_id = e.estudiante_id and ea.fecha_fin is null
      and a.sala_id = e.sala_id
  ) c
  where e.aula_id is null and c.n = 1
    and (select count(distinct y.aula_id) from "_EstudiantesToAulas" y
          where y.estudiante_id = e.estudiante_id and y.fecha_fin is null) > 1
  on conflict (evaluacion_id) do nothing;

  update evaluaciones_estudiante e
  set aula_id = r.aula_id
  from aula_20261124_evaluaciones r
  where r.evaluacion_id = e.id and e.aula_id is null;
end $$;

-- Control: una fila de totales y, debajo, el detalle de lo que queda por mirar. Sin nombres ni DNI.
select 'TOTAL' as fila,
       (select count(*) from aula_20261124_evaluaciones where regla = 'C')::text as dato_1_asignadas_regla_c,
       (select count(*) from evaluaciones_estudiante where aula_id is null)::text as dato_2_quedan_sin_aula,
       null::text as sala_evaluacion, null::text as sala_aula, null::text as aula,
       null::text as docentes_del_aula, null::text as alumnos_del_aula
union all
select 'SALA DISTINTA (regla ' || r.regla || ')', left(e.id::text, 8), e.tipo_id || ' ' || e.fecha_creacion::date,
       e.sala_id::text, a.sala_id::text, left(a.id::text, 8),
       (select count(*) from "_ProfesoresToAulas" pa where pa.aula_id = a.id and pa.fecha_fin is null)::text,
       (select count(*) from "_EstudiantesToAulas" x where x.aula_id = a.id and x.fecha_fin is null)::text
from aula_20261124_evaluaciones r
join evaluaciones_estudiante e on e.id = r.evaluacion_id
join aulas a on a.id = r.aula_id
where a.sala_id <> e.sala_id
union all
select 'SIGUE SIN AULA', left(e.id::text, 8), e.tipo_id || ' ' || e.fecha_creacion::date,
       e.sala_id::text, null, null, null, null
from evaluaciones_estudiante e where e.aula_id is null;
