-- Sonido inicial (salas 4 y 5): reemplaza las partes "por vocal" del 14/10 por los
-- 5 estímulos reales del cuadernillo, con la consigna larga compartida en `detalle`.
-- Una sola sentencia (el editor de Supabase corre mal los scripts de varias).
-- Debe devolver: vocales_desactivadas = 10, partes_nuevas = 10, respuestas_copiadas = 355.
-- chr(191) = "¿", chr(63) = "?", chr(10) = salto de línea (pegados directo se perdían).
with viejas as (
  update preguntas set activa = false
  where titulo = 'Sonido Inicial' and sala_id in (4, 5) and activa = true
    and consigna like '%de la palabra con%'
  returning id, sala_id, area_id, numero, grupopregunta, tipopregunta, demostrable, materiales, puntaje, version
),
base as (
  select distinct on (sala_id) * from viejas order by sala_id, id
),
estimulos(sala_id, orden, alargada, letra, nota) as (
  values
    (4, 1, 'ooooso',       'O', ''),
    (4, 2, 'aaaaavión',    'A', ''),
    (4, 3, 'eeeeeestrella', 'E', ''),
    (4, 4, 'uuuuva',       'U', ''),
    (4, 5, 'aaaauto',      'A', ''),
    (5, 1, 'eeeeestrella', 'E', ''),
    (5, 2, 'aaaaauto',     'A', ''),
    (5, 3, 'ffffflor',     'F', ' (el sonido fff, no la sílaba flo)'),
    (5, 4, 'sssssapo',     'S', ' (el sonido sss, no la sílaba sa)'),
    (5, 5, 'mmmmoto',      'M', ' (el sonido mmm, no la sílaba mo)')
),
consignas(sala_id, texto) as (
  values
    (4, '"Te voy a mostrar unos dibujos y me tenés que decir con qué letra empieza."' || chr(10) || chr(10)
        || 'Presente al niño las imágenes del cuadernillo de estímulos y modele con los dos estímulos de ejemplo: "Esto es un eeeeelefante, y empieza con E." Luego señale el siguiente dibujo y diga: "Esto es una aaaabeja. '
        || chr(191) || 'Me podés decir con qué letra empieza aaaaaabeja' || chr(63) || ' Bien, abeja empieza con A."' || chr(10) || chr(10)
        || 'A continuación presente los demás estímulos y pídale que diga con qué letra empieza. Es importante que el evaluador diga el nombre del objeto y extienda exageradamente el primer sonido.'),
    (5, '"Te voy a mostrar unos dibujos y tenés que decirme con qué letra empiezan."' || chr(10) || chr(10)
        || 'Presente al niño las imágenes del cuadernillo de estímulos y modele con los dos estímulos de ejemplo: "Esto es un eeeeelefante, y empieza con E." Luego señale el siguiente dibujo y diga: "Esto es un mmmartillo. '
        || chr(191) || 'Me podés decir con qué letra empieza mmmartillo' || chr(63) || ' Bien, martillo empieza con MMM."' || chr(10) || chr(10)
        || 'A continuación presente los demás estímulos y pídale que diga con qué letra empieza. Es importante que el evaluador diga el nombre del objeto y extienda exageradamente el primer fonema "mmm", no la primera sílaba "mmmaaa".' || chr(10) || chr(10)
        || 'No se considera correcto si dice la primera sílaba (ej.: moto empieza con MO, en lugar de decir que empieza por MMMM).')
),
nuevas as (
  insert into preguntas (id, sala_id, numero, orden, grupopregunta, area_id, tipopregunta, demostrable, titulo, materiales, consigna, detalle, aprueba_con, puntaje, version, activa, puntaje_invertido, imagen_url)
  select gen_random_uuid()::text, b.sala_id, b.numero, e.orden, b.grupopregunta, b.area_id, b.tipopregunta, b.demostrable, 'Sonido Inicial', b.materiales,
         'Diga: ' || e.alargada, c.texto, 'Responde ' || e.letra || e.nota, b.puntaje, b.version, true, false, null
  from base b
  join estimulos e on e.sala_id = b.sala_id
  join consignas c on c.sala_id = b.sala_id
  returning id, sala_id, area_id
),
original as (
  -- la pregunta única de antes del 14/10 (inactiva); conserva las 71 respuestas reales
  select id, sala_id, area_id from preguntas
  where titulo = 'Sonido Inicial' and sala_id in (4, 5) and activa = false
    and consigna like '%de palabras que empiezan%'
),
copiadas as (
  insert into evaluaciones_estudiante_area_preguntas (evaluaciones_area_id, pregunta_id, respuesta)
  select r.evaluaciones_area_id, n.id, r.respuesta
  from evaluaciones_estudiante_area_preguntas r
  join original o on o.id = r.pregunta_id
  join nuevas n on n.sala_id = o.sala_id and n.area_id = o.area_id
  where r.respuesta is not null
  returning id
)
select
  (select count(*) from viejas)   as vocales_desactivadas,
  (select count(*) from nuevas)   as partes_nuevas,
  (select count(*) from copiadas) as respuestas_copiadas;
