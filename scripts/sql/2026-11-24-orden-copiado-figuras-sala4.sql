-- 2026-11-24 · Sala 4, Sensoriomotora, pauta 2 (Copiado de figuras): orden de las partes según el cuadernillo.
-- Antes: 2.1 horizontal, 2.2 vertical (las 4 partes tenían orden = null y salían por id).
-- Ahora: 2.1 vertical, 2.2 horizontal, 2.3 círculo, 2.4 cruz.
-- ESCRIBE EN LA BASE. Sólo cambia preguntas.orden de 4 filas; no toca consignas ni respuestas, así que lo ya
-- respondido sigue pegado a la misma figura (sólo cambia en qué posición se muestra).
-- Una sola sentencia (el editor de Supabase corre mal los scripts de varias). No depende de ids: sirve en dev y prod.
-- Debe devolver 4 filas: 1 vertical, 2 horizontal, 3 círculo, 4 cruz.
-- Vuelta atrás: la misma sentencia con "set orden = null".
with nuevo(orden, guarda) as (
  values
    (1, '%línea vertical%'),
    (2, '%línea horizontal%'),
    (3, '%círculo%'),
    (4, '%cruz%')
),
cambiadas as (
  update preguntas p set orden = n.orden
  from nuevo n, areas a
  where a.id = p.area_id and a.nombre = 'Sensoriomotora'
    and p.sala_id = 4 and p.numero = 2 and p.activa is not false
    and p.consigna like n.guarda
  returning p.orden, p.id, p.consigna
)
select * from cambiadas order by orden;
