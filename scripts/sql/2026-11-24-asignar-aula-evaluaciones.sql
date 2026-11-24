-- 2026-11-24 · ESCRIBE EN LA BASE. Completa el aula de las evaluaciones que quedaron sin aula.
-- Regla: A) si el alumno estaba en UN aula el día de la evaluación, esa;
--        B) si no figuraba en ninguna ese día y hoy está en UN aula, esa.
-- No toca las de alumnos con más de un aula (caso C) ni sin aula (caso D).
-- Deja registro en `aula_20261124_evaluaciones` (qué evaluación, qué aula, por qué regla): sirve para volver atrás.
-- Se puede correr más de una vez: la segunda no cambia nada. Un solo bloque: o se aplica todo o nada.
do $$
begin
  create table if not exists aula_20261124_evaluaciones (
    evaluacion_id uuid primary key,
    aula_id       uuid not null,
    regla         text not null,
    aplicado      timestamptz not null default now()
  );
  alter table aula_20261124_evaluaciones enable row level security;

  insert into aula_20261124_evaluaciones (evaluacion_id, aula_id, regla)
  select e.id,
         case when f.n = 1 then f.aula else h.aula end,
         case when f.n = 1 then 'A' else 'B' end
  from evaluaciones_estudiante e
  cross join lateral (
    select count(distinct ea.aula_id) as n, (array_agg(ea.aula_id))[1] as aula
    from "_EstudiantesToAulas" ea
    where ea.estudiante_id = e.estudiante_id
      and ea.fecha_inicio <= e.fecha_creacion
      and (ea.fecha_fin is null or ea.fecha_fin > e.fecha_creacion)
  ) f
  cross join lateral (
    select count(distinct ea.aula_id) as n, (array_agg(ea.aula_id))[1] as aula
    from "_EstudiantesToAulas" ea
    where ea.estudiante_id = e.estudiante_id and ea.fecha_fin is null
  ) h
  where e.aula_id is null
    and (f.n = 1 or (f.n = 0 and h.n = 1))
  on conflict (evaluacion_id) do nothing;

  update evaluaciones_estudiante e
  set aula_id = r.aula_id
  from aula_20261124_evaluaciones r
  where r.evaluacion_id = e.id and e.aula_id is null;
end $$;

-- Control.
select (select count(*) from aula_20261124_evaluaciones where regla = 'A') as asignadas_regla_a,
       (select count(*) from aula_20261124_evaluaciones where regla = 'B') as asignadas_regla_b,
       (select count(*) from aula_20261124_evaluaciones r
          join evaluaciones_estudiante e on e.id = r.evaluacion_id
          join aulas a on a.id = r.aula_id
         where a.sala_id <> e.sala_id)                                     as con_sala_distinta_al_aula,
       (select count(*) from evaluaciones_estudiante where aula_id is null) as quedan_sin_aula;
