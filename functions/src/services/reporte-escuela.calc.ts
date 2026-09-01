import type {
  ReporteInput, ReporteEscuela, EvaluacionReporteRow, RespuestaReporteRow, AreaCatalogo,
  ResultadoTipo, EstudianteResultado, PautasArea, PautaItem, Comparativo, EstudianteComparativo,
  EstadoAreaComparativo, SalaReporte, ResumenTipo, ResumenCierre, ResumenComparativo, PorArea, CierraCon,
} from "../interfaces/reporte-escuela.interface";
import { esRespuestaCorrecta, apruebaPauta, pautaCompleta, claveGrupoPauta } from "../utils/pautas";

const TOP_PAUTAS = 3;

// ── Helpers de dominio ────────────────────────────────────────────────────────

type Ev = EvaluacionReporteRow;

/** Estado por área de una evaluación: "A" | "D" | null (sin registro). */
function estadosArea(ev: Ev, areas: AreaCatalogo[]): Record<string, "A" | "D" | null> {
  const out: Record<string, "A" | "D" | null> = {};
  for (const a of areas) {
    const reg = ev.evaluaciones_estudiante_area.find((x) => x.area_id === a.id);
    out[a.id] = reg ? (reg.estado_id === "A" ? "A" : "D") : null;
  }
  return out;
}

/** "Apellido Apellido2, Nombre"; "Sin nombre" si no hay datos. */
export function nombreEstudiante(p: Ev["estudiantes"]["personas"]): string {
  const apellidos = [p.primer_apellido, p.segundo_apellido].filter((x) => x && x.trim()).map((x) => x!.trim()).join(" ");
  const nombre = (p.nombre ?? "").trim();
  if (apellidos && nombre) return `${apellidos}, ${nombre}`;
  return apellidos || nombre || "Sin nombre";
}

const porApellido = (a: string, b: string) => a.localeCompare(b, "es");

/** Por (estudiante, tipo) se queda con la evaluación de `fecha_creacion` más reciente. */
function deduplicar(evaluaciones: Ev[]): Ev[] {
  const ultima = new Map<string, Ev>();
  for (const ev of evaluaciones) {
    const k = `${ev.estudiante_id}|${ev.tipo_id}`;
    const prev = ultima.get(k);
    if (!prev || ev.fecha_creacion > prev.fecha_creacion) ultima.set(k, ev);
  }
  return [...ultima.values()];
}

// ── Pautas ────────────────────────────────────────────────────────────────────

interface PautaAgregada { evaluacionId: string; areaId: string; grupo: string; numero: number | null; texto: string; total: number; respondidas: number; correctas: number }

/** Agrupa las sub-preguntas activas por (evaluación, área, grupo). */
export function agruparPautas(respuestas: RespuestaReporteRow[]): Map<string, PautaAgregada[]> {
  const porClave = new Map<string, PautaAgregada>();
  for (const r of respuestas) {
    const p = r.preguntas;
    if (p.activa === false) continue;
    const evaluacionId = r.evaluaciones_estudiante_area.evaluacion_estudiante_id;
    const areaId = r.evaluaciones_estudiante_area.area_id;
    const grupo = claveGrupoPauta(p);
    const k = `${evaluacionId}|${areaId}|${grupo}`;
    let g = porClave.get(k);
    if (!g) {
      g = { evaluacionId, areaId, grupo, numero: p.numero, texto: p.titulo ?? p.consigna ?? `Pauta ${grupo}`, total: 0, respondidas: 0, correctas: 0 };
      porClave.set(k, g);
    }
    g.total += 1;
    if (r.respuesta !== null && r.respuesta !== undefined) g.respondidas += 1;
    if (esRespuestaCorrecta(r.respuesta, p.puntaje_invertido)) g.correctas += 1;
  }
  const porEvaluacion = new Map<string, PautaAgregada[]>();
  for (const g of porClave.values()) {
    const arr = porEvaluacion.get(g.evaluacionId) ?? [];
    arr.push(g);
    porEvaluacion.set(g.evaluacionId, arr);
  }
  return porEvaluacion;
}

/** Top 3 pautas más desaprobadas por área sobre un conjunto de evaluaciones. */
function pautasDe(evaluaciones: Ev[], porEvaluacion: Map<string, PautaAgregada[]>, areas: AreaCatalogo[]): PautasArea[] {
  const acc = new Map<string, { areaId: string; grupo: string; numero: number | null; texto: string; desaprobaron: number; evaluados: number }>();
  for (const ev of evaluaciones) {
    for (const g of porEvaluacion.get(ev.id) ?? []) {
      if (!pautaCompleta(g)) continue;
      const k = `${g.areaId}|${g.grupo}`;
      const a = acc.get(k) ?? { areaId: g.areaId, grupo: g.grupo, numero: g.numero, texto: g.texto, desaprobaron: 0, evaluados: 0 };
      a.evaluados += 1;
      if (!apruebaPauta(g)) a.desaprobaron += 1;
      acc.set(k, a);
    }
  }
  return areas.map((area) => {
    const items: PautaItem[] = [...acc.values()]
      .filter((a) => a.areaId === area.id)
      .sort((x, y) => y.desaprobaron - x.desaprobaron || ordenNumero(x.numero, y.numero))
      .slice(0, TOP_PAUTAS)
      .map((a) => ({ numero: a.numero, texto: a.texto, desaprobaron: a.desaprobaron, evaluados: a.evaluados }));
    return { area_id: area.id, items };
  });
}

/** Ordena por `numero` ascendente; los `null` ("Q:") al final. */
function ordenNumero(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

// ── Resultado por tipo ────────────────────────────────────────────────────────

function porAreaDe(evaluaciones: Ev[], areas: AreaCatalogo[]): PorArea[] {
  return areas.map((a) => {
    let evaluados = 0, aprobados = 0;
    for (const ev of evaluaciones) {
      const reg = ev.evaluaciones_estudiante_area.find((x) => x.area_id === a.id);
      if (!reg) continue;
      evaluados += 1;
      if (reg.estado_id === "A") aprobados += 1;
    }
    return { area_id: a.id, evaluados, aprobados };
  });
}

function severidad(e: EstudianteResultado): number {
  return Object.values(e.areas).filter((v) => v === "D").length;
}

function resultadoTipo(evaluaciones: Ev[], areas: AreaCatalogo[], porEvaluacion: Map<string, PautaAgregada[]>, cierraCon: ResultadoTipo["cierra_con"]): ResultadoTipo | null {
  if (evaluaciones.length === 0) return null;
  const estudiantes: EstudianteResultado[] = evaluaciones
    .map((ev) => ({ estudiante_id: ev.estudiante_id, nombre: nombreEstudiante(ev.estudiantes.personas), aprobado: ev.estado_id === "A", areas: estadosArea(ev, areas) }))
    .sort((a, b) => severidad(b) - severidad(a) || porApellido(a.nombre, b.nombre));
  return {
    evaluados: evaluaciones.length,
    aprobados: evaluaciones.filter((ev) => ev.estado_id === "A").length,
    cierra_con: cierraCon,
    por_area: porAreaDe(evaluaciones, areas),
    estudiantes,
    pautas: pautasDe(evaluaciones, porEvaluacion, areas),
  };
}

// ── Comparativo ───────────────────────────────────────────────────────────────

function comparativoDe(iniciales: Ev[], cierrePorEstudiante: Map<string, Ev>, areas: AreaCatalogo[], porEvaluacion: Map<string, PautaAgregada[]>): Comparativo | null {
  if (iniciales.length === 0) return null;
  const aprobaronInicial = iniciales.filter((ev) => ev.estado_id === "A");
  const noPasaron = iniciales.filter((ev) => ev.estado_id !== "A");

  const estudiantes: EstudianteComparativo[] = noPasaron.map((ini) => {
    const cie = cierrePorEstudiante.get(ini.estudiante_id);
    const ei = estadosArea(ini, areas);
    const out: Record<string, EstadoAreaComparativo> = {};
    if (!cie) {
      for (const a of areas) out[a.id] = "pendiente";
      return { estudiante_id: ini.estudiante_id, nombre: nombreEstudiante(ini.estudiantes.personas), resultado: "pendiente", areas: out };
    }
    const ec = estadosArea(cie, areas);
    for (const a of areas) {
      const i = ei[a.id], c = ec[a.id];
      if (i === "D") out[a.id] = c === "A" ? "recupero" : "persiste";       // sin dato en el cierre conserva lo último conocido
      else out[a.id] = c === "D" ? "nueva" : "ok";
    }
    return { estudiante_id: ini.estudiante_id, nombre: nombreEstudiante(ini.estudiantes.personas), resultado: cie.estado_id === "A" ? "recupero" : "persiste", areas: out };
  });

  const peso = (e: EstudianteComparativo) => (e.resultado === "pendiente" ? -1 : Object.values(e.areas).filter((v) => v === "persiste" || v === "nueva").length);
  estudiantes.sort((a, b) => peso(b) - peso(a) || porApellido(a.nombre, b.nombre));

  const recuperaron = estudiantes.filter((e) => e.resultado === "recupero").length;
  const persisten = estudiantes.filter((e) => e.resultado === "persiste").length;
  const pendientes = estudiantes.filter((e) => e.resultado === "pendiente").length;

  const por_area = areas.map((a) => {
    let aprobados_inicial = 0, aprobados_cierre = 0, sin_dato = 0;
    for (const ev of aprobaronInicial) {
      const i = estadosArea(ev, areas)[a.id];
      if (i === "A") { aprobados_inicial += 1; aprobados_cierre += 1; }
      if (i === null) sin_dato += 1;
    }
    for (const ini of noPasaron) {
      const i = estadosArea(ini, areas)[a.id];
      if (i === "A") aprobados_inicial += 1;
      if (i === null) { sin_dato += 1; continue; }
      const cie = cierrePorEstudiante.get(ini.estudiante_id);
      if (!cie) { sin_dato += 1; continue; }
      const c = estadosArea(cie, areas)[a.id];
      if (c === null) { sin_dato += 1; if (i === "A") aprobados_cierre += 1; continue; }
      if (c === "A") aprobados_cierre += 1;
    }
    return { area_id: a.id, aprobados_inicial, aprobados_cierre, sin_dato };
  });

  const reevaluados = noPasaron.filter((ini) => cierrePorEstudiante.has(ini.estudiante_id)).map((ini) => cierrePorEstudiante.get(ini.estudiante_id)!);
  return {
    base: iniciales.length,
    aprobaron_inicial: aprobaronInicial.length,
    reevaluados: reevaluados.length,
    recuperaron, persisten, pendientes,
    cierra_con: aprobaronInicial.length + recuperaron,
    por_area,
    estudiantes,
    pautas: pautasDe(reevaluados, porEvaluacion, areas),
  };
}

// ── Sala ──────────────────────────────────────────────────────────────────────

/**
 * cierra_con: total = inicial ∪ cierre; aprobado = aprobó la inicial, o (no la aprobó / no la tiene) y aprobó el cierre.
 * Se usa tanto por sala (`armarSala`) como a nivel escuela (`resumenCierre`, sobre todas las evaluaciones).
 */
function calcularCierraCon(inicialPorEst: Map<string, Ev>, cierrePorEst: Map<string, Ev>): CierraCon {
  const todos = new Set([...inicialPorEst.keys(), ...cierrePorEst.keys()]);
  let aprobados = 0;
  for (const est of todos) {
    const ini = inicialPorEst.get(est), cie = cierrePorEst.get(est);
    if (ini?.estado_id === "A" || (ini?.estado_id !== "A" && cie?.estado_id === "A")) aprobados += 1;
  }
  return { aprobados, total: todos.size };
}

function armarSala(salaId: number, nombreSala: string, evs: Ev[], areas: AreaCatalogo[], porEvaluacion: Map<string, PautaAgregada[]>): SalaReporte {
  const iniciales = evs.filter((e) => e.tipo_id === "inicial");
  const cierres = evs.filter((e) => e.tipo_id === "cierre");
  const inicialPorEst = new Map(iniciales.map((e) => [e.estudiante_id, e]));
  const cierrePorEst = new Map(cierres.map((e) => [e.estudiante_id, e]));

  const cierraCon = cierres.length ? calcularCierraCon(inicialPorEst, cierrePorEst) : null;

  return {
    sala_id: salaId,
    sala: nombreSala,
    inicial: resultadoTipo(iniciales, areas, porEvaluacion, null),
    cierre: resultadoTipo(cierres, areas, porEvaluacion, cierraCon),
    comparativo: comparativoDe(iniciales, cierrePorEst, areas, porEvaluacion),
  };
}

// ── Resumen ───────────────────────────────────────────────────────────────────

function sumarPorArea(listas: PorArea[][], areas: AreaCatalogo[]): PorArea[] {
  return areas.map((a) => ({
    area_id: a.id,
    evaluados: listas.reduce((s, l) => s + (l.find((p) => p.area_id === a.id)?.evaluados ?? 0), 0),
    aprobados: listas.reduce((s, l) => s + (l.find((p) => p.area_id === a.id)?.aprobados ?? 0), 0),
  }));
}

function resumenTipo(salas: SalaReporte[], tipo: "inicial" | "cierre", areas: AreaCatalogo[]): ResumenTipo | null {
  const con = salas.filter((s) => s[tipo]);
  if (con.length === 0) return null;
  return {
    evaluados: con.reduce((s, x) => s + x[tipo]!.evaluados, 0),
    aprobados: con.reduce((s, x) => s + x[tipo]!.aprobados, 0),
    por_area: sumarPorArea(con.map((x) => x[tipo]!.por_area), areas),
    por_sala: con.map((x) => ({ sala_id: x.sala_id, sala: x.sala, evaluados: x[tipo]!.evaluados, aprobados: x[tipo]!.aprobados, por_area: x[tipo]!.por_area })),
  };
}

function resumenCierre(salas: SalaReporte[], areas: AreaCatalogo[], evaluaciones: Ev[]): ResumenCierre | null {
  const base = resumenTipo(salas, "cierre", areas);
  if (!base) return null;
  // cierra_con es a nivel escuela: no es la suma de `cierre.cierra_con` por sala, porque una sala sin
  // ningún cierre cargado todavía tiene `cierre: null` (nada que sumar) pero sus alumnos que aprobaron
  // la inicial ya cuentan como aprobados a fin de año. Se recalcula sobre todas las evaluaciones de la escuela.
  const inicialPorEst = new Map(evaluaciones.filter((e) => e.tipo_id === "inicial").map((e) => [e.estudiante_id, e]));
  const cierrePorEst = new Map(evaluaciones.filter((e) => e.tipo_id === "cierre").map((e) => [e.estudiante_id, e]));
  return { ...base, cierra_con: calcularCierraCon(inicialPorEst, cierrePorEst) };
}

function resumenComparativo(salas: SalaReporte[], areas: AreaCatalogo[]): ResumenComparativo | null {
  const con = salas.filter((s) => s.comparativo);
  if (con.length === 0) return null;
  const sum = (f: (c: Comparativo) => number) => con.reduce((s, x) => s + f(x.comparativo!), 0);
  return {
    base: sum((c) => c.base), aprobaron_inicial: sum((c) => c.aprobaron_inicial), reevaluados: sum((c) => c.reevaluados),
    recuperaron: sum((c) => c.recuperaron), persisten: sum((c) => c.persisten), pendientes: sum((c) => c.pendientes), cierra_con: sum((c) => c.cierra_con),
    por_area: areas.map((a) => ({
      area_id: a.id,
      aprobados_inicial: sum((c) => c.por_area.find((p) => p.area_id === a.id)?.aprobados_inicial ?? 0),
      aprobados_cierre: sum((c) => c.por_area.find((p) => p.area_id === a.id)?.aprobados_cierre ?? 0),
    })),
    por_sala: con.map((x) => {
      const c = x.comparativo!;
      return { sala_id: x.sala_id, sala: x.sala, base: c.base, aprobaron_inicial: c.aprobaron_inicial, recuperaron: c.recuperaron, persisten: c.persisten, pendientes: c.pendientes, cierra_con: c.cierra_con };
    }),
  };
}

// ── Entrada ───────────────────────────────────────────────────────────────────

/**
 * Construye el reporte de escuela completo (spec §4) a partir de las filas del repositorio.
 * Función pura: sin I/O, determinística.
 */
export function buildReporteEscuela(input: ReporteInput): ReporteEscuela {
  const areas: AreaCatalogo[] = [...input.catalogos.areas]
    .sort((a, b) => a.orden - b.orden)
    .map((a) => ({ id: a.id, nombre: a.nombre ?? a.id, orden: a.orden }));
  const nombreSala = new Map(input.catalogos.salas.map((s) => [s.id, s.nombre ?? `Sala de ${s.id}`]));

  const evaluaciones = deduplicar(input.evaluaciones);
  const porEvaluacion = agruparPautas(input.respuestas);

  // La sala de un estudiante es la de su inicial; si no tiene, la del cierre.
  const salaDe = new Map<string, number>();
  for (const ev of evaluaciones) if (ev.tipo_id === "inicial") salaDe.set(ev.estudiante_id, ev.sala_id);
  for (const ev of evaluaciones) if (!salaDe.has(ev.estudiante_id)) salaDe.set(ev.estudiante_id, ev.sala_id);

  const porSala = new Map<number, Ev[]>();
  for (const ev of evaluaciones) {
    const sid = salaDe.get(ev.estudiante_id)!;
    porSala.set(sid, [...(porSala.get(sid) ?? []), ev]);
  }

  const salas = [...porSala.keys()].sort((a, b) => a - b)
    .map((sid) => armarSala(sid, nombreSala.get(sid) ?? `Sala de ${sid}`, porSala.get(sid)!, areas, porEvaluacion));

  return {
    escuela: input.escuela,
    periodo: input.periodo,
    generado_en: input.generadoEn.toISOString(),
    areas,
    salas,
    resumen: {
      inicial: resumenTipo(salas, "inicial", areas),
      cierre: resumenCierre(salas, areas, evaluaciones),
      comparativo: resumenComparativo(salas, areas),
    },
    turno: input.turno,
    turnos: input.turnos,
  };
}
