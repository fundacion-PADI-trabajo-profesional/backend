-- Preguntas para el evaluador (ADR 0020).
-- Correr ANTES de desplegar el backend: el detalle y los listados de evaluaciones ya seleccionan estas
-- columnas, así que sin ellas TODAS las consultas de evaluaciones fallan.
-- Es aditivo e idempotente: columnas nullable, sin valor por defecto, no toca filas existentes.
-- Vuelta atrás: alter table evaluaciones_estudiante drop column ... (se pierden los datos cargados).

alter table evaluaciones_estudiante
  add column if not exists sesiones_completadas varchar,
  add column if not exists en_tratamiento boolean,
  add column if not exists tiene_cud boolean,
  add column if not exists observaciones varchar;

-- Rango de sesiones: menos de 5 / entre 5 y 9 / 10 o más (sólo evaluaciones de cierre).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evaluaciones_estudiante_sesiones_check') then
    alter table evaluaciones_estudiante
      add constraint evaluaciones_estudiante_sesiones_check
      check (sesiones_completadas is null or sesiones_completadas in ('menos_5', 'entre_5_y_9', '10_o_mas'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evaluaciones_estudiante_observaciones_check') then
    alter table evaluaciones_estudiante
      add constraint evaluaciones_estudiante_observaciones_check
      check (observaciones is null or char_length(observaciones) <= 500);
  end if;
end $$;

-- Verificación (debe devolver 4 filas):
-- select column_name, data_type from information_schema.columns
--  where table_name = 'evaluaciones_estudiante'
--    and column_name in ('sesiones_completadas', 'en_tratamiento', 'tiene_cud', 'observaciones');
