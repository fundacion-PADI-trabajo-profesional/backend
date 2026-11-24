-- 2026-11-24 · SÓLO LECTURA. Control de datos antes de armar reportes de 2026.
-- Una fila por control: cuántos casos hay y a qué parte del reporte le pegan. Sin nombres ni DNI.
-- "Terminada" = estado A o D (lo único que entra en el reporte de escuela y en las estadísticas).
with ev as (
  select e.*, s.escuela_id as escuela_alumno, a.escuela_id as escuela_aula, a.sala_id as sala_aula
  from evaluaciones_estudiante e
  join estudiantes s on s.id = e.estudiante_id
  left join aulas a on a.id = e.aula_id
  where e.fecha_creacion >= date '2026-01-01' and e.fecha_creacion < date '2027-01-01'
),
activas as (
  select ea.estudiante_id, count(distinct ea.aula_id) as aulas, count(distinct a.escuela_id) as escuelas
  from "_EstudiantesToAulas" ea join aulas a on a.id = ea.aula_id
  where ea.fecha_fin is null
  group by ea.estudiante_id
)
select * from (
  select 1 as n, 'Evaluaciones 2026 (total)' as control, count(*) as cantidad, 'referencia' as a_que_afecta from ev
  union all select 2, 'Terminadas (A/D)', count(*), 'referencia: lo que entra al reporte' from ev where estado_id in ('A','D')
  union all select 3, 'Cierres SIN terminar (N/E)', count(*), 'NO entran al reporte: el chico figura como no evaluado al cierre'
    from ev where tipo_id = 'cierre' and estado_id not in ('A','D')
  union all select 4, 'Iniciales SIN terminar (N/E)', count(*), 'NO entran al reporte' from ev where tipo_id = 'inicial' and estado_id not in ('A','D')
  union all select 5, 'Alumnos con cierre terminado y sin inicial terminada', count(*), 'sin comparacion inicial vs cierre para ese chico'
    from (select estudiante_id, sala_id from ev where estado_id in ('A','D') group by 1, 2
          having bool_or(tipo_id = 'cierre') and not bool_or(tipo_id = 'inicial')) x
  union all select 6, 'Duplicados (mismo alumno, sala, tipo)', count(*), 'DEBE SER 0: contaria dos veces al chico'
    from (select 1 from ev group by estudiante_id, sala_id, tipo_id having count(*) > 1) x
  union all select 7, 'Evaluaciones sin aula', count(*), 'desaparecen del reporte de escuela al filtrar por turno' from ev where aula_id is null
  union all select 8, 'Evaluaciones de alumnos sin escuela', count(*), 'no entran al reporte de ninguna escuela' from ev where escuela_alumno is null
  union all select 9, 'Aula de la evaluacion en OTRA escuela que la del alumno', count(*), 'el reporte de escuela y las estadisticas las cuentan en escuelas distintas'
    from ev where escuela_aula is not null and escuela_aula is distinct from escuela_alumno
  union all select 10, 'Sala de la evaluacion distinta a la del aula', count(*), 'el reporte agrupa por la sala de la evaluacion; revisar si son errores de carga'
    from ev where sala_aula is not null and sala_aula <> sala_id
  union all select 11, 'Alumnos evaluados con MAS DE UN aula activa', count(*), 'solo la etiqueta de aula en el Excel (no duplica numeros)'
    from activas where aulas > 1 and estudiante_id in (select estudiante_id from ev)
  union all select 12, 'Alumnos evaluados con aulas en MAS DE UNA escuela', count(*), 'escuela dudosa para ese chico'
    from activas where escuelas > 1 and estudiante_id in (select estudiante_id from ev)
  union all select 13, 'Evaluaciones en aulas sin docente asignado', count(*), 'aparecen en estadisticas por aula bajo un aula que quizas no es real'
    from ev where aula_id is not null and not exists
      (select 1 from "_ProfesoresToAulas" pa where pa.aula_id = ev.aula_id and pa.fecha_fin is null)
) t order by n;
