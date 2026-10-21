-- Cambio 4, paso 1 (correr ANTES de mergear el backend, que ya selecciona la columna).
-- Son DOS sentencias: correr primero la del ALTER sola, después la del WITH.

-- 1) La columna (idempotente).
alter table preguntas add column if not exists minimo_aprobacion smallint;

-- 2) Valores del cuadernillo + sala 3 Comunicación y Lenguaje como seis pautas.
-- Debe devolver: renumeradas = 6, reglas = 1, partes_con_minimo = 40.
with renum as (
  update preguntas p set numero = v.numero
  from (values
    ('Comunicación de Necesidades', 1),
    ('Uso de Lenguaje', 2),
    ('Uso de frases completas', 3),
    ('Identificación de Imágenes de Objetos Familiares', 4),
    ('Reconocimiento de Objetos de la Vida Cotidiana', 5),
    ('Reconocimiento de Acciones en Dibujos', 6)) as v(titulo, numero)
  where p.sala_id = 3 and p.area_id = 'CL' and p.titulo = v.titulo and p.activa is distinct from false
  returning p.id
),
regla as (
  update reglas_aprobacion set aprueba_con = 5, puntaje_total = 6
  where sala_id = 3 and area_id = 'CL'
  returning id
),
minimos as (
  update preguntas p set minimo_aprobacion = v.minimo
  from (values
    (3, 'SM', 4, 2),  -- Copiado de figuras, 3 partes
    (4, 'CL', 5, 3),  -- Sonido inicial, 5
    (4, 'CL', 6, 2),  -- Intrusos, 3
    (4, 'CL', 7, 3),  -- Responde a preguntas, 4
    (4, 'CL', 8, 3),  -- Nombra objetos, 4
    (4, 'SM', 2, 3),  -- Copiado de figuras, 4
    (5, 'CL', 4, 3),  -- Sonido inicial, 5
    (5, 'CL', 5, 3),  -- Intrusos, 3
    (5, 'CL', 6, 4),  -- Absurdo verbal, 5
    (5, 'SM', 1, 3)   -- Copiado de figuras, 4
  ) as v(sala_id, area_id, numero, minimo)
  where p.sala_id = v.sala_id and p.area_id = v.area_id and p.numero = v.numero and p.activa is distinct from false
  returning p.id
)
select (select count(*) from renum) as renumeradas,
       (select count(*) from regla) as reglas,
       (select count(*) from minimos) as partes_con_minimo;
