-- Evaluaciones que respondieron las partes por vocal (entre el 14/10 y el 16/10) y no
-- tienen respuestas en las partes nuevas: se les carga el resultado que ya tenían
-- (3 o más Sí -> las 5 partes en Sí; 3 o más No -> las 5 en No). Decisión de Nish 16/10.
-- Debe devolver 3 filas (sala 4) con valor 1 o 0 y partes_cargadas = 5.
with vocales as (select id, sala_id, area_id from preguntas where titulo = 'Sonido Inicial' and activa = false and consigna like '%de la palabra con%'),
nuevas as (select id, sala_id, area_id from preguntas where titulo = 'Sonido Inicial' and activa = true),
por_eval as (
  select r.evaluaciones_area_id, v.sala_id, v.area_id,
         count(*) filter (where r.respuesta = 1) as si,
         count(*) filter (where r.respuesta = 0) as no
  from evaluaciones_estudiante_area_preguntas r
  join vocales v on v.id = r.pregunta_id
  where r.respuesta is not null
    and not exists (select 1 from evaluaciones_estudiante_area_preguntas n join nuevas q on q.id = n.pregunta_id where n.evaluaciones_area_id = r.evaluaciones_area_id)
  group by 1, 2, 3),
decision as (select *, case when si >= 3 then 1 when no >= 3 then 0 end as valor from por_eval),
insertadas as (
  insert into evaluaciones_estudiante_area_preguntas (evaluaciones_area_id, pregunta_id, respuesta)
  select d.evaluaciones_area_id, q.id, d.valor
  from decision d join nuevas q on q.sala_id = d.sala_id and q.area_id = d.area_id
  where d.valor is not null
  returning evaluaciones_area_id)
select d.sala_id, d.si, d.no, d.valor,
       (select count(*) from insertadas i where i.evaluaciones_area_id = d.evaluaciones_area_id) as partes_cargadas
from decision d;
