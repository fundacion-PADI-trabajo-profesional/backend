-- 2026-11-24 · VUELTA ATRÁS de `2026-11-24-fusion-evaluaciones.sql`. ESCRIBE EN LA BASE.
-- Deja las evaluaciones afectadas EXACTAMENTE como estaban en el respaldo: vuelve a crear las borradas y
-- restaura tipo, estado, puntajes, respuestas, observaciones y datos del evaluador de las que quedaron.
-- OJO: lo que alguien haya cargado en esas evaluaciones DESPUÉS de la fusión se pierde (vuelve a la foto).
-- No borra las tablas de respaldo. Un solo bloque: o se aplica todo o nada.
do $$
begin
  -- sacar el estado actual de las evaluaciones respaldadas que todavía existen
  delete from evaluaciones_estudiante_area_preguntas rp
  using evaluaciones_estudiante_area ea
  where rp.evaluaciones_area_id = ea.id
    and ea.evaluacion_estudiante_id in (select id from fusion_20261124_evaluaciones);
  delete from evaluaciones_estudiante_area
  where evaluacion_estudiante_id in (select id from fusion_20261124_evaluaciones);
  delete from evaluaciones_estudiante
  where id in (select id from fusion_20261124_evaluaciones);

  -- volver a poner la foto
  insert into evaluaciones_estudiante select * from fusion_20261124_evaluaciones;
  insert into evaluaciones_estudiante_area select * from fusion_20261124_areas;
  insert into evaluaciones_estudiante_area_preguntas select * from fusion_20261124_respuestas;
end $$;

-- Control: cuántas evaluaciones se restauraron y cuántas iniciales volvió a haber desde agosto.
select (select count(*) from fusion_20261124_evaluaciones) as evaluaciones_restauradas,
       (select count(*) from evaluaciones_estudiante
        where fecha_creacion >= date '2026-08-01' and fecha_creacion < date '2027-01-01'
          and tipo_id = 'inicial') as iniciales_desde_agosto;
