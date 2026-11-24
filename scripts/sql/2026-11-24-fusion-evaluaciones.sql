-- 2026-11-24 · Corrección de tipo (inicial -> cierre) + fusión de evaluaciones duplicadas.
-- ESCRIBE EN LA BASE. Correr ANTES `2026-11-24-fusion-evaluaciones-ensayo.sql` (sólo lectura) y revisar que el plan sea el esperado.
--
-- Regla (acordada con Nacho, 24/11/2026):
--   · Toda evaluación con fecha_creacion desde el 01/08/2026 es de CIERRE.
--   · Si un alumno tiene 2 o más desde esa fecha (misma sala), queda UNA: la que tiene más respuestas
--     (empate: la que ya es cierre; después la más nueva).
--   · A la que queda se le copian las respuestas que le falten; si una pregunta está respondida distinto en dos
--     evaluaciones, vale la respuesta más reciente. También hereda, si no los tiene, la observación de cada área
--     y los datos del evaluador (sesiones, tratamiento, CUD, observaciones).
--   · Las que sobran se respaldan y se borran.
--   · Se recalculan puntaje y estado de las áreas que recibieron respuestas, y el estado de su evaluación
--     (misma regla que calculateAreaScore / computeEvaluacionEstadoFromAreas).
--   · Las iniciales anteriores a agosto (mayo/junio) NO se tocan.
--
-- Cómo está hecho:
--   · Un solo bloque `do`: o se aplica todo o no se aplica nada.
--   · Calcula todo al momento de correr (no usa ids fijos): los datos siguen cambiando.
--   · Respaldo previo, con RLS activado para que no quede expuesto por la API:
--       fusion_20261124_evaluaciones / _areas / _respuestas  (copia exacta de TODAS las evaluaciones afectadas,
--                                                             también de la que queda, tal como estaban antes)
--       fusion_20261124_plan     (qué evaluación quedó y cuáles se borraron en cada alumno)
--       fusion_20261124_resumen  (conteos de cada corrida)
--   · Se puede correr de nuevo sin riesgo: si no hay nada para corregir, no hace nada.
--   · Vuelta atrás: `2026-11-24-fusion-evaluaciones-rollback.sql`.
--
-- Al terminar, la última consulta muestra el resumen de la corrida.
do $$
declare
  v_grupos int; v_borradas int; v_copiadas int; v_pisadas int; v_a_cierre int; v_areas int; v_evals int;
begin
  -- ── 0) Tablas de respaldo ─────────────────────────────────────────────────────────────────────────────
  create table if not exists fusion_20261124_evaluaciones as select * from evaluaciones_estudiante where false;
  create table if not exists fusion_20261124_areas as select * from evaluaciones_estudiante_area where false;
  create table if not exists fusion_20261124_respuestas as select * from evaluaciones_estudiante_area_preguntas where false;
  create table if not exists fusion_20261124_plan (
    eval_id uuid not null, queda_id uuid not null, rol text not null, tipo_antes text, respuestas int,
    respaldado_en timestamptz not null default now());
  create table if not exists fusion_20261124_resumen (
    corrida timestamptz not null default now(), alumnos_fusionados int, evaluaciones_borradas int,
    respuestas_copiadas int, respuestas_pisadas int, pasadas_a_cierre int, areas_recalculadas int,
    evaluaciones_con_estado_nuevo int);
  alter table fusion_20261124_evaluaciones enable row level security;
  alter table fusion_20261124_areas enable row level security;
  alter table fusion_20261124_respuestas enable row level security;
  alter table fusion_20261124_plan enable row level security;
  alter table fusion_20261124_resumen enable row level security;

  -- ── 1) Qué evaluaciones entran y cuál queda en cada alumno ────────────────────────────────────────────
  create temp table t_v on commit drop as
    select id, estudiante_id, sala_id, tipo_id, fecha_creacion
    from evaluaciones_estudiante
    where fecha_creacion >= date '2026-08-01' and fecha_creacion < date '2027-01-01';

  -- respuestas vigentes (pregunta activa, con valor); si una pregunta tiene dos filas en la misma evaluación, la última
  create temp table t_resp on commit drop as
    select distinct on (v.id, rp.pregunta_id)
           v.id as eval_id, ea.area_id, rp.pregunta_id, rp.respuesta,
           coalesce(rp.fecha_actualizacion, rp.fecha_creacion) as cuando
    from t_v v
    join evaluaciones_estudiante_area ea on ea.evaluacion_estudiante_id = v.id
    join evaluaciones_estudiante_area_preguntas rp on rp.evaluaciones_area_id = ea.id
    join preguntas p on p.id = rp.pregunta_id and p.activa is distinct from false
    where rp.respuesta is not null
    order by v.id, rp.pregunta_id, coalesce(rp.fecha_actualizacion, rp.fecha_creacion) desc;

  create temp table t_g on commit drop as
    select v.*, coalesce(c.n, 0) as n_resp,
           count(*) over w as en_grupo,
           row_number() over (w order by coalesce(c.n, 0) desc, (v.tipo_id = 'cierre') desc, v.fecha_creacion desc, v.id) as pos,
           first_value(v.id) over (w order by coalesce(c.n, 0) desc, (v.tipo_id = 'cierre') desc, v.fecha_creacion desc, v.id) as queda_id
    from t_v v
    left join (select eval_id, count(*) as n from t_resp group by 1) c on c.eval_id = v.id
    window w as (partition by v.estudiante_id, v.sala_id);

  -- afectadas: las de alumnos con 2+ evaluaciones, y las iniciales sueltas
  create temp table t_afect on commit drop as
    select g.* from t_g g
    where g.en_grupo > 1 or g.tipo_id = 'inicial';

  -- ── 2) Respaldo (sólo lo que todavía no esté respaldado: vale la primera foto) ────────────────────────
  insert into fusion_20261124_plan (eval_id, queda_id, rol, tipo_antes, respuestas)
    select a.id, a.queda_id, case when a.pos = 1 then 'queda' else 'se_borra' end, a.tipo_id, a.n_resp
    from t_afect a
    where not exists (select 1 from fusion_20261124_evaluaciones b where b.id = a.id);
  insert into fusion_20261124_respuestas
    select rp.* from evaluaciones_estudiante_area_preguntas rp
    join evaluaciones_estudiante_area ea on ea.id = rp.evaluaciones_area_id
    join t_afect a on a.id = ea.evaluacion_estudiante_id
    where not exists (select 1 from fusion_20261124_evaluaciones b where b.id = a.id);
  insert into fusion_20261124_areas
    select ea.* from evaluaciones_estudiante_area ea
    join t_afect a on a.id = ea.evaluacion_estudiante_id
    where not exists (select 1 from fusion_20261124_evaluaciones b where b.id = a.id);
  insert into fusion_20261124_evaluaciones
    select e.* from evaluaciones_estudiante e
    join t_afect a on a.id = e.id
    where not exists (select 1 from fusion_20261124_evaluaciones b where b.id = a.id);

  -- ── 3) La respuesta que vale para cada pregunta de cada alumno con duplicados: la más reciente ────────
  create temp table t_final on commit drop as
    select distinct on (g.queda_id, r.pregunta_id)
           g.queda_id, r.eval_id, r.area_id, r.pregunta_id, r.respuesta, r.cuando
    from t_resp r
    join t_g g on g.id = r.eval_id
    where g.en_grupo > 1
    order by g.queda_id, r.pregunta_id, r.cuando desc, (r.eval_id = g.queda_id) desc, r.eval_id;

  select count(*) filter (where p.pregunta_id is null),
         count(*) filter (where p.pregunta_id is not null and p.respuesta <> f.respuesta)
    into v_copiadas, v_pisadas
  from t_final f
  left join t_resp p on p.eval_id = f.queda_id and p.pregunta_id = f.pregunta_id
  where f.eval_id <> f.queda_id;

  -- la que queda tiene que tener la fila del área (se crean todas al crear la evaluación; por las dudas)
  insert into evaluaciones_estudiante_area (evaluacion_estudiante_id, area_id, estado_id, puntaje)
    select distinct f.queda_id, f.area_id, 'N', 0
    from t_final f
    where not exists (select 1 from evaluaciones_estudiante_area ea
                      where ea.evaluacion_estudiante_id = f.queda_id and ea.area_id = f.area_id);

  create temp table t_areas_tocadas (id uuid) on commit drop;

  -- 3a) preguntas que la que queda ya tiene como fila (vacía o con otro valor)
  with u as (
    update evaluaciones_estudiante_area_preguntas rp
    set respuesta = f.respuesta, fecha_actualizacion = f.cuando
    from t_final f
    join evaluaciones_estudiante_area ea on ea.evaluacion_estudiante_id = f.queda_id and ea.area_id = f.area_id
    where rp.evaluaciones_area_id = ea.id and rp.pregunta_id = f.pregunta_id
      and f.eval_id <> f.queda_id
      and rp.respuesta is distinct from f.respuesta
    returning rp.evaluaciones_area_id
  )
  insert into t_areas_tocadas select distinct evaluaciones_area_id from u;

  -- 3b) preguntas que la que queda no tiene
  with i as (
    insert into evaluaciones_estudiante_area_preguntas (evaluaciones_area_id, pregunta_id, respuesta, fecha_creacion, fecha_actualizacion)
    select ea.id, f.pregunta_id, f.respuesta, f.cuando, f.cuando
    from t_final f
    join evaluaciones_estudiante_area ea on ea.evaluacion_estudiante_id = f.queda_id and ea.area_id = f.area_id
    where f.eval_id <> f.queda_id
      and not exists (select 1 from evaluaciones_estudiante_area_preguntas x
                      where x.evaluaciones_area_id = ea.id and x.pregunta_id = f.pregunta_id)
    returning evaluaciones_area_id
  )
  insert into t_areas_tocadas select distinct evaluaciones_area_id from i;

  -- ── 4) Observación de cada área y datos del evaluador: se heredan sólo si la que queda no los tiene ───
  update evaluaciones_estudiante_area dst
  set observacion = src.observacion
  from (
    select distinct on (g.queda_id, ea.area_id) g.queda_id, ea.area_id, ea.observacion
    from t_g g
    join evaluaciones_estudiante_area ea on ea.evaluacion_estudiante_id = g.id
    where g.en_grupo > 1 and g.pos > 1 and nullif(btrim(ea.observacion), '') is not null
    order by g.queda_id, ea.area_id, g.fecha_creacion desc, g.id
  ) src
  where dst.evaluacion_estudiante_id = src.queda_id and dst.area_id = src.area_id
    and nullif(btrim(dst.observacion), '') is null;

  update evaluaciones_estudiante dst set sesiones_completadas = (
      select o.sesiones_completadas from evaluaciones_estudiante o join t_g g on g.id = o.id
      where g.queda_id = dst.id and g.pos > 1 and o.sesiones_completadas is not null
      order by o.fecha_creacion desc, o.id limit 1)
  where dst.sesiones_completadas is null and dst.id in (select queda_id from t_g where en_grupo > 1);
  update evaluaciones_estudiante dst set en_tratamiento = (
      select o.en_tratamiento from evaluaciones_estudiante o join t_g g on g.id = o.id
      where g.queda_id = dst.id and g.pos > 1 and o.en_tratamiento is not null
      order by o.fecha_creacion desc, o.id limit 1)
  where dst.en_tratamiento is null and dst.id in (select queda_id from t_g where en_grupo > 1);
  update evaluaciones_estudiante dst set tiene_cud = (
      select o.tiene_cud from evaluaciones_estudiante o join t_g g on g.id = o.id
      where g.queda_id = dst.id and g.pos > 1 and o.tiene_cud is not null
      order by o.fecha_creacion desc, o.id limit 1)
  where dst.tiene_cud is null and dst.id in (select queda_id from t_g where en_grupo > 1);
  update evaluaciones_estudiante dst set observaciones = (
      select o.observaciones from evaluaciones_estudiante o join t_g g on g.id = o.id
      where g.queda_id = dst.id and g.pos > 1 and nullif(btrim(o.observaciones), '') is not null
      order by o.fecha_creacion desc, o.id limit 1)
  where nullif(btrim(dst.observaciones), '') is null and dst.id in (select queda_id from t_g where en_grupo > 1);

  -- ── 5) Borrar las que sobran (ya respaldadas) ─────────────────────────────────────────────────────────
  delete from evaluaciones_estudiante_area_preguntas rp
  using evaluaciones_estudiante_area ea, t_g g
  where rp.evaluaciones_area_id = ea.id and ea.evaluacion_estudiante_id = g.id and g.pos > 1;
  delete from evaluaciones_estudiante_area ea
  using t_g g
  where ea.evaluacion_estudiante_id = g.id and g.pos > 1;
  delete from evaluaciones_estudiante e
  using t_g g
  where e.id = g.id and g.pos > 1;
  get diagnostics v_borradas = row_count;

  select count(*) into v_grupos from t_g where en_grupo > 1 and pos = 1;

  -- ── 6) Todo lo que quedó desde agosto es cierre ───────────────────────────────────────────────────────
  update evaluaciones_estudiante e set tipo_id = 'cierre'
  from t_v v
  where e.id = v.id and e.tipo_id = 'inicial';
  get diagnostics v_a_cierre = row_count;

  -- ── 7) Recalcular puntaje y estado de las áreas que recibieron respuestas ─────────────────────────────
  with partes as (
    select ea.id as area_eval_id, e.sala_id, ea.area_id,
           coalesce(p.numero::text, 'Q:' || p.id) as grupo, coalesce(p.puntaje, 1) as valor, p.minimo_aprobacion,
           r.respuesta,
           case when coalesce(p.puntaje_invertido, false) then r.respuesta = 0 else r.respuesta = 1 end as correcta
    from evaluaciones_estudiante_area ea
    join (select distinct id from t_areas_tocadas) t on t.id = ea.id
    join evaluaciones_estudiante e on e.id = ea.evaluacion_estudiante_id
    join preguntas p on p.sala_id = e.sala_id and p.area_id = ea.area_id and p.activa is distinct from false
    left join lateral (
      select x.respuesta from evaluaciones_estudiante_area_preguntas x
      where x.evaluaciones_area_id = ea.id and x.pregunta_id = p.id
      order by coalesce(x.fecha_actualizacion, x.fecha_creacion) desc limit 1
    ) r on true
  ),
  grupos as (
    select area_eval_id, sala_id, area_id, grupo,
           count(*) as total, count(respuesta) as respondidas, count(*) filter (where correcta) as correctas,
           max(valor) as valor, max(minimo_aprobacion) as minimo
    from partes group by 1, 2, 3, 4
  ),
  areas as (
    select area_eval_id, sala_id, area_id,
           bool_and(respondidas = total) as completa,
           sum(valor) as total_puntos,
           coalesce(sum(valor) filter (where correctas >= coalesce(minimo, ceil(total / 2.0))), 0) as puntaje
    from grupos group by 1, 2, 3
  ),
  nuevo as (
    select a.area_eval_id, a.puntaje,
           case when not a.completa then 'E'
                when a.puntaje >= coalesce(ra.aprueba_con, ceil(coalesce(ra.puntaje_total, a.total_puntos) * 0.6)) then 'A'
                else 'D' end as estado_nuevo
    from areas a
    left join lateral (
      select x.aprueba_con, x.puntaje_total from reglas_aprobacion x
      where x.sala_id = a.sala_id and x.area_id = a.area_id limit 1
    ) ra on true
  )
  update evaluaciones_estudiante_area ea
  set estado_id = n.estado_nuevo, puntaje = n.puntaje
  from nuevo n
  where ea.id = n.area_eval_id;
  get diagnostics v_areas = row_count;

  with est as (
    select ea.evaluacion_estudiante_id as id,
           case when bool_and(ea.estado_id = 'N') then 'N'
                when bool_or(ea.estado_id = 'E') then 'E'
                when not bool_and(ea.estado_id in ('A', 'D')) then 'E'
                when bool_and(ea.estado_id = 'A') then 'A'
                else 'D' end as estado_nuevo
    from evaluaciones_estudiante_area ea
    where ea.evaluacion_estudiante_id in (
      select ea2.evaluacion_estudiante_id from evaluaciones_estudiante_area ea2
      join t_areas_tocadas t on t.id = ea2.id)
    group by 1
  )
  update evaluaciones_estudiante e set estado_id = est.estado_nuevo
  from est
  where e.id = est.id and e.estado_id <> est.estado_nuevo;
  get diagnostics v_evals = row_count;

  insert into fusion_20261124_resumen (alumnos_fusionados, evaluaciones_borradas, respuestas_copiadas,
                                       respuestas_pisadas, pasadas_a_cierre, areas_recalculadas, evaluaciones_con_estado_nuevo)
  values (v_grupos, v_borradas, v_copiadas, v_pisadas, v_a_cierre, v_areas, v_evals);
end $$;

-- Resumen de la corrida (la fila de arriba es la de recién) y control: alumnos que siguen con 2+ evaluaciones
-- desde agosto o con alguna inicial desde agosto. Los dos controles tienen que dar 0.
select r.*,
       (select count(*) from (select 1 from evaluaciones_estudiante
                              where fecha_creacion >= date '2026-08-01' and fecha_creacion < date '2027-01-01'
                              group by estudiante_id, sala_id having count(*) > 1) d) as control_duplicados,
       (select count(*) from evaluaciones_estudiante
        where fecha_creacion >= date '2026-08-01' and fecha_creacion < date '2027-01-01'
          and tipo_id = 'inicial') as control_iniciales
from fusion_20261124_resumen r
order by r.corrida desc;
