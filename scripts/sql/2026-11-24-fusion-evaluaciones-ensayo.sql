-- 2026-11-24 · ENSAYO de la corrección de tipo + fusión. SOLO LECTURA: no cambia nada, muestra qué se haría.
-- Regla (acordada con Nacho 24/11):
--   · Toda evaluación con fecha desde el 01/08/2026 es de CIERRE.
--   · Si un alumno tiene 2 o más desde esa fecha (misma sala), queda UNA: la que tiene más respuestas
--     (empate: la que ya es cierre; después la más nueva).
--   · A la que queda se le copian las respuestas que le falten; si una pregunta está respondida distinto en dos
--     evaluaciones, vale la respuesta más reciente.
--   · Las que sobran se respaldan y se borran.
-- Las iniciales de mayo/junio NO entran: son iniciales de verdad y no se tocan.
-- Una fila por alumno afectado. Sin nombres ni DNI. Cada evaluación: tipo/estado/día-mes/prof/respuestas.
--   pasa_a_cierre     = la que queda hoy figura como inicial y se le cambia el tipo.
--   se_copian         = respuestas que la que queda no tenía y recibe de las otras.
--   se_pisan          = respuestas de la que queda que se reemplazan por una más reciente de otra evaluación.
--   aula_desde_agosto = cuántas evaluaciones de cada tipo tiene esa misma aula desde agosto (contexto).
with v as (
  select * from evaluaciones_estudiante
  where fecha_creacion >= date '2026-08-01' and fecha_creacion < date '2027-01-01'
),
resp as (
  select v.id as eval_id, v.estudiante_id, v.sala_id, rp.pregunta_id, rp.respuesta,
         coalesce(rp.fecha_actualizacion, rp.fecha_creacion) as cuando
  from v
  join evaluaciones_estudiante_area ea on ea.evaluacion_estudiante_id = v.id
  join evaluaciones_estudiante_area_preguntas rp on rp.evaluaciones_area_id = ea.id
  join preguntas p on p.id = rp.pregunta_id and p.activa is distinct from false
  where rp.respuesta is not null
),
cnt as (
  select eval_id, count(distinct pregunta_id) as n from resp group by 1
),
g as (
  select v.*, coalesce(c.n, 0) as n_resp,
         count(*) over (partition by v.estudiante_id, v.sala_id) as en_grupo,
         row_number() over (partition by v.estudiante_id, v.sala_id
                            order by coalesce(c.n, 0) desc, (v.tipo_id = 'cierre') desc, v.fecha_creacion desc, v.id) as pos
  from v left join cnt c on c.eval_id = v.id
),
afectados as (
  select estudiante_id, sala_id from g group by 1, 2
  having count(*) > 1 or bool_or(tipo_id = 'inicial')
),
final as (
  -- la respuesta que vale para cada pregunta del alumno: la más reciente
  select distinct on (estudiante_id, sala_id, pregunta_id) estudiante_id, sala_id, pregunta_id, respuesta
  from resp order by estudiante_id, sala_id, pregunta_id, cuando desc, eval_id
),
propia as (
  select distinct on (eval_id, pregunta_id) eval_id, pregunta_id, respuesta
  from resp order by eval_id, pregunta_id, cuando desc
),
sob as (
  select * from g where pos = 1
),
dif as (
  select f.estudiante_id, f.sala_id,
         count(*) filter (where pr.pregunta_id is null) as se_copian,
         count(*) filter (where pr.pregunta_id is not null and pr.respuesta <> f.respuesta) as se_pisan
  from final f
  join sob s on s.estudiante_id = f.estudiante_id and s.sala_id = f.sala_id
  left join propia pr on pr.eval_id = s.id and pr.pregunta_id = f.pregunta_id
  group by 1, 2
),
aula as (
  select aula_id, count(*) filter (where tipo_id = 'cierre') as c, count(*) filter (where tipo_id = 'inicial') as i
  from v group by 1
)
select left(s.estudiante_id::text, 8) as alumno, s.sala_id, s.en_grupo as evaluaciones,
       format('%s/%s/%s/prof %s/%s resp', s.tipo_id, s.estado_id, to_char(s.fecha_creacion, 'DD-MM'),
              left(s.profesor_id::text, 4), s.n_resp) as queda,
       (s.tipo_id = 'inicial') as pasa_a_cierre,
       coalesce((select string_agg(format('%s/%s/%s/prof %s/%s resp', o.tipo_id, o.estado_id,
                                          to_char(o.fecha_creacion, 'DD-MM'), left(o.profesor_id::text, 4), o.n_resp),
                                   '  ||  ' order by o.pos)
                 from g o
                 where o.estudiante_id = s.estudiante_id and o.sala_id = s.sala_id and o.pos > 1), '') as se_borran,
       coalesce(d.se_copian, 0) as se_copian,
       coalesce(d.se_pisan, 0) as se_pisan,
       format('cierre:%s inicial:%s', a.c, a.i) as aula_desde_agosto
from sob s
join afectados af using (estudiante_id, sala_id)
left join dif d using (estudiante_id, sala_id)
left join aula a on a.aula_id is not distinct from s.aula_id
order by evaluaciones desc, 1;
