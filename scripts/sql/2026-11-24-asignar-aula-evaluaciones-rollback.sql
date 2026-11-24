-- 2026-11-24 · VUELTA ATRÁS de `asignar-aula-evaluaciones.sql`. ESCRIBE EN LA BASE.
-- Vuelve a dejar sin aula las evaluaciones que ese script completó (sólo si siguen con el aula que les puso).
update evaluaciones_estudiante e
set aula_id = null
from aula_20261124_evaluaciones r
where r.evaluacion_id = e.id and e.aula_id = r.aula_id;

select count(*) as quedan_sin_aula from evaluaciones_estudiante where aula_id is null;
