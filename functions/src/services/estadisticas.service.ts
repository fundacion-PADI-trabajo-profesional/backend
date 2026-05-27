import { EstadisticasRepository } from "../repositories/estadisticas.repository";

export interface HeatmapResponse {
  periodo: number;
  tipo: string;
  areas: Array<{ id: string; nombre: string; orden: number }>;
  filas: Array<{
    id: string;
    nombre: string;
    meta?: Record<string, string | undefined>;
    valores: Record<string, { porcentaje: number | null; evaluaciones: number }>;
  }>;
  total_evaluaciones: number;
}

type Nivel = "zona" | "escuela" | "aula";

function getPeriodoRange(anio: number) {
  return {
    periodoStart: new Date(Date.UTC(anio, 0, 1)),
    periodoEnd: new Date(Date.UTC(anio + 1, 0, 1)),
  };
}

function buildReglasMap(
  reglas: Array<{ area_id: string | null; sala_id: number | null; puntaje_total: number | null }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of reglas) {
    if (r.area_id && r.sala_id !== null && r.puntaje_total !== null) {
      map.set(`${r.area_id}__${r.sala_id}`, r.puntaje_total);
    }
  }
  return map;
}

function armarHeatmap(
  evaluaciones: any[],
  reglasMap: Map<string, number>,
  areas: Array<{ id: string; nombre: string; orden: number }>,
  nivel: Nivel,
  periodo: number,
  tipo: string
): HeatmapResponse {
  type FilaAccum = {
    id: string;
    nombre: string;
    meta?: Record<string, string | undefined>;
    sumas: Map<string, { suma: number; count: number }>;
  };

  const filasMap = new Map<string, FilaAccum>();
  let totalEvaluaciones = 0;

  for (const ev of evaluaciones) {
    const aula = ev.aulas ?? null;
    const zona = aula?.escuela?.zona ?? ev.estudiantes?.escuela?.zona ?? null;
    const escuela = aula?.escuela ?? ev.estudiantes?.escuela ?? null;

    let filaId: string;
    let filaNombre: string;
    let filaMeta: Record<string, string | undefined> | undefined;

    if (nivel === "zona") {
      if (!zona) continue;
      filaId = zona.id;
      filaNombre = zona.nombre;
    } else if (nivel === "escuela") {
      if (!escuela) continue;
      filaId = escuela.id;
      filaNombre = escuela.nombre;
      filaMeta = zona ? { zona_nombre: String(zona.nombre) } : undefined;
    } else {
      // nivel === "aula": solo evaluaciones con aula asignada
      if (!aula) continue;
      filaId = aula.id;
      filaNombre = `${aula.comision} - ${aula.turno}`;
      filaMeta = { comision: String(aula.comision), turno: String(aula.turno) };
    }

    if (!filasMap.has(filaId)) {
      filasMap.set(filaId, { id: filaId, nombre: filaNombre, meta: filaMeta, sumas: new Map() });
    }
    const fila = filasMap.get(filaId)!;

    for (const ea of ev.evaluaciones_estudiante_area) {
      const maxKey = `${ea.area_id}__${ev.sala_id}`;
      const max = reglasMap.get(maxKey) ?? null;
      if (max === null || max === 0 || ea.puntaje === null || ea.puntaje === undefined) continue;

      const pct = Math.min(1, Math.max(0, ea.puntaje / max));
      const existing = fila.sumas.get(ea.area_id) ?? { suma: 0, count: 0 };
      existing.suma += pct;
      existing.count += 1;
      fila.sumas.set(ea.area_id, existing);
    }

    totalEvaluaciones += 1;
  }

  const filas = Array.from(filasMap.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      ...(fila.meta ? { meta: fila.meta } : {}),
      valores: Object.fromEntries(
        areas.map((area) => {
          const s = fila.sumas.get(area.id);
          return [
            area.id,
            s
              ? { porcentaje: s.suma / s.count, evaluaciones: s.count }
              : { porcentaje: null, evaluaciones: 0 },
          ];
        })
      ),
    }));

  return { periodo, tipo, areas, filas, total_evaluaciones: totalEvaluaciones };
}

export interface EvolucionArea {
  area_id: string;
  area_nombre: string;
  area_orden: number;
  pct_inicial: number | null;
  pct_final: number | null;
  delta: number | null;
  evaluaciones_inicial: number;
  evaluaciones_final: number;
}

export interface EvolucionResponse {
  periodo: number;
  areas: EvolucionArea[];
}

export interface AreaCritica {
  area_id: string;
  area_nombre: string;
  area_orden: number;
  porcentaje_promedio: number | null;
  evaluaciones: number;
}

export interface AreasCriticasResponse {
  periodo: number;
  tipo: string;
  areas: AreaCritica[];
}

export interface AreaEnRiesgo {
  area_id: string;
  area_nombre: string;
  porcentaje: number;
  evaluaciones: number;
}

export interface EstudianteRiesgo {
  estudiante_id: string;
  nombre: string;
  primer_apellido: string;
  escuela_nombre: string;
  zona_nombre?: string;
  areas_en_riesgo: AreaEnRiesgo[];
  total_areas_en_riesgo: number;
}

export interface RiesgoResponse {
  periodo: number;
  umbral: number;
  estudiantes: EstudianteRiesgo[];
  total: number;
}

function promediarPorArea(
  evaluaciones: any[],
  reglasMap: Map<string, number>
): Map<string, { suma: number; count: number }> {
  const map = new Map<string, { suma: number; count: number }>();
  for (const ev of evaluaciones) {
    for (const ea of ev.evaluaciones_estudiante_area) {
      const max = reglasMap.get(`${ea.area_id}__${ev.sala_id}`) ?? null;
      if (max === null || max === 0 || ea.puntaje === null || ea.puntaje === undefined) continue;
      const pct = Math.min(1, Math.max(0, ea.puntaje / max));
      const existing = map.get(ea.area_id) ?? { suma: 0, count: 0 };
      existing.suma += pct;
      existing.count += 1;
      map.set(ea.area_id, existing);
    }
  }
  return map;
}

function calcularEvolucion(
  evInicial: any[],
  evFinal: any[],
  reglasMap: Map<string, number>,
  areas: Array<{ id: string; nombre: string; orden: number }>,
  periodo: number
): EvolucionResponse {
  const inicialMap = promediarPorArea(evInicial, reglasMap);
  const finalMap = promediarPorArea(evFinal, reglasMap);

  const areasResult: EvolucionArea[] = areas.map((area) => {
    const ini = inicialMap.get(area.id);
    const fin = finalMap.get(area.id);
    const pctInicial = ini ? ini.suma / ini.count : null;
    const pctFinal = fin ? fin.suma / fin.count : null;
    const delta =
      pctInicial !== null && pctFinal !== null ? pctFinal - pctInicial : null;
    return {
      area_id: area.id,
      area_nombre: area.nombre,
      area_orden: area.orden,
      pct_inicial: pctInicial,
      pct_final: pctFinal,
      delta,
      evaluaciones_inicial: ini?.count ?? 0,
      evaluaciones_final: fin?.count ?? 0,
    };
  });

  return { periodo, areas: areasResult };
}

function calcularAreasCriticas(
  evaluaciones: any[],
  reglasMap: Map<string, number>,
  areas: Array<{ id: string; nombre: string; orden: number }>,
  tipo: string,
  periodo: number
): AreasCriticasResponse {
  const areaMap = promediarPorArea(evaluaciones, reglasMap);

  const areasResult: AreaCritica[] = areas
    .map((area) => {
      const s = areaMap.get(area.id);
      return {
        area_id: area.id,
        area_nombre: area.nombre,
        area_orden: area.orden,
        porcentaje_promedio: s ? s.suma / s.count : null,
        evaluaciones: s?.count ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.porcentaje_promedio === null) return 1;
      if (b.porcentaje_promedio === null) return -1;
      return a.porcentaje_promedio - b.porcentaje_promedio;
    });

  return { periodo, tipo, areas: areasResult };
}

const UMBRAL_DEFAULT = 0.5;
const AREAS_RIESGO_MIN = 2;

function calcularRiesgo(
  evaluaciones: any[],
  reglasMap: Map<string, number>,
  areasMap: Map<string, string>,
  umbral: number,
  periodo: number
): RiesgoResponse {
  type EstAccum = {
    estudiante_id: string;
    nombre: string;
    primer_apellido: string;
    escuela_nombre: string;
    zona_nombre?: string;
    areas: Map<string, { suma: number; count: number }>;
  };

  const estudiantesMap = new Map<string, EstAccum>();

  for (const ev of evaluaciones) {
    const estId = ev.estudiante_id as string;
    const persona = ev.estudiantes?.personas ?? null;
    const escuela = ev.aulas?.escuela ?? ev.estudiantes?.escuela ?? null;
    const zona = escuela?.zona ?? null;

    if (!estudiantesMap.has(estId)) {
      estudiantesMap.set(estId, {
        estudiante_id: estId,
        nombre: persona?.nombre ?? "",
        primer_apellido: persona?.primer_apellido ?? "",
        escuela_nombre: escuela?.nombre ?? "",
        zona_nombre: zona?.nombre,
        areas: new Map(),
      });
    }
    const est = estudiantesMap.get(estId)!;

    for (const ea of ev.evaluaciones_estudiante_area) {
      const maxKey = `${ea.area_id}__${ev.sala_id}`;
      const max = reglasMap.get(maxKey) ?? null;
      if (max === null || max === 0 || ea.puntaje === null || ea.puntaje === undefined) continue;

      const pct = Math.min(1, Math.max(0, ea.puntaje / max));
      const existing = est.areas.get(ea.area_id) ?? { suma: 0, count: 0 };
      existing.suma += pct;
      existing.count += 1;
      est.areas.set(ea.area_id, existing);
    }
  }

  const estudiantes: EstudianteRiesgo[] = [];

  for (const est of estudiantesMap.values()) {
    const areasEnRiesgo: AreaEnRiesgo[] = [];

    for (const [area_id, { suma, count }] of est.areas) {
      const pct = suma / count;
      if (pct < umbral) {
        areasEnRiesgo.push({
          area_id,
          area_nombre: areasMap.get(area_id) ?? area_id,
          porcentaje: pct,
          evaluaciones: count,
        });
      }
    }

    if (areasEnRiesgo.length >= AREAS_RIESGO_MIN) {
      areasEnRiesgo.sort((a, b) => a.porcentaje - b.porcentaje);
      estudiantes.push({
        estudiante_id: est.estudiante_id,
        nombre: est.nombre,
        primer_apellido: est.primer_apellido,
        escuela_nombre: est.escuela_nombre,
        ...(est.zona_nombre !== undefined ? { zona_nombre: est.zona_nombre } : {}),
        areas_en_riesgo: areasEnRiesgo,
        total_areas_en_riesgo: areasEnRiesgo.length,
      });
    }
  }

  estudiantes.sort((a, b) => b.total_areas_en_riesgo - a.total_areas_en_riesgo);

  return { periodo, umbral, estudiantes, total: estudiantes.length };
}

export interface ItemAprobacion {
  pregunta_id: string;
  consigna: string | null;
  area_id: string | null;
  total: number;
  correctos: number;
  tasa_aprobacion: number;
}

export interface AprobacionPreguntasResponse {
  periodo: number;
  aula_id: string;
  area_id: string | null;
  items: ItemAprobacion[];
}

export interface RangoDistribucion {
  rango: string;
  min: number;
  max: number;
  cantidad: number;
}

export interface DistribucionResponse {
  periodo: number;
  aula_id: string;
  total_estudiantes: number;
  rangos: RangoDistribucion[];
}

export interface DocenteActividad {
  profesor_id: string;
  nombre: string;
  primer_apellido: string;
  total_evaluaciones: number;
}

export interface ActividadResponse {
  periodo: number;
  docentes: DocenteActividad[];
}

export interface CoberturaZona {
  zona_id: string;
  zona_nombre: string;
  evaluaciones: number;
  estudiantes_evaluados: number;
}

export interface CoberturaResponse {
  periodo: number;
  zonas: CoberturaZona[];
  total_evaluaciones: number;
  total_estudiantes_evaluados: number;
}

export interface ComparativaArea {
  area_id: string;
  area_nombre: string;
  area_orden: number;
  pct_escuela: number | null;
  pct_zona: number | null;
  pct_nacional: number | null;
}

export interface ComparativaResponse {
  periodo: number;
  tipo: string;
  areas: ComparativaArea[];
}

export interface ProgresoEval {
  evaluacion_id: string;
  fecha: string;
  tipo: string;
  pct: number | null;
}

export interface ProgresoArea {
  area_id: string;
  area_nombre: string;
  area_orden: number;
  evaluaciones: ProgresoEval[];
}

export interface ProgresionResponse {
  estudiante_id: string;
  nombre: string;
  primer_apellido: string;
  periodo: number | null;
  areas: ProgresoArea[];
}

const NIVELES_NSE = ["alto", "medio", "bajo", "sin_definir"] as const;
type NivelNSE = typeof NIVELES_NSE[number];

export interface PorcentajeNivel {
  porcentaje: number | null;
  evaluaciones: number;
}

export interface AreaPorNivel {
  area_id: string;
  area_nombre: string;
  area_orden: number;
  por_nivel: Record<NivelNSE, PorcentajeNivel>;
}

export interface RendimientoNivelResponse {
  periodo: number;
  tipo: string;
  areas: AreaPorNivel[];
  total_evaluaciones: number;
}

function calcularRendimientoNivel(
  evaluaciones: any[],
  reglasMap: Map<string, number>,
  areas: Array<{ id: string; nombre: string; orden: number }>,
  tipo: string,
  periodo: number
): RendimientoNivelResponse {
  const sumas: Record<NivelNSE, Map<string, { suma: number; count: number }>> = {
    alto: new Map(),
    medio: new Map(),
    bajo: new Map(),
    sin_definir: new Map(),
  };

  let totalEvaluaciones = 0;

  for (const ev of evaluaciones) {
    const escuela = ev.aulas?.escuela ?? ev.estudiantes?.escuela ?? null;
    if (!escuela) continue;

    const nivelRaw: string = escuela.nivel_socioeconomico ?? "sin_definir";
    const nivel = (NIVELES_NSE as readonly string[]).includes(nivelRaw)
      ? (nivelRaw as NivelNSE)
      : "sin_definir";

    for (const ea of ev.evaluaciones_estudiante_area) {
      const max = reglasMap.get(`${ea.area_id}__${ev.sala_id}`) ?? null;
      if (max === null || max === 0 || ea.puntaje === null || ea.puntaje === undefined) continue;
      const pct = Math.min(1, Math.max(0, ea.puntaje / max));
      const existing = sumas[nivel].get(ea.area_id) ?? { suma: 0, count: 0 };
      existing.suma += pct;
      existing.count += 1;
      sumas[nivel].set(ea.area_id, existing);
    }

    totalEvaluaciones += 1;
  }

  const areasResult: AreaPorNivel[] = areas.map((area) => {
    const por_nivel = {} as Record<NivelNSE, PorcentajeNivel>;
    for (const n of NIVELES_NSE) {
      const s = sumas[n].get(area.id);
      por_nivel[n] = s
        ? { porcentaje: s.suma / s.count, evaluaciones: s.count }
        : { porcentaje: null, evaluaciones: 0 };
    }
    return { area_id: area.id, area_nombre: area.nombre, area_orden: area.orden, por_nivel };
  });

  return { periodo, tipo, areas: areasResult, total_evaluaciones: totalEvaluaciones };
}

const RANGOS_DIST = [
  { rango: "0–20%", min: 0, max: 0.2 },
  { rango: "21–40%", min: 0.21, max: 0.4 },
  { rango: "41–60%", min: 0.41, max: 0.6 },
  { rango: "61–80%", min: 0.61, max: 0.8 },
  { rango: "81–100%", min: 0.81, max: 1 },
];

function calcularActividad(evaluaciones: any[], periodo: number): ActividadResponse {
  const map = new Map<string, { nombre: string; primer_apellido: string; count: number }>();
  for (const ev of evaluaciones) {
    const pid = ev.profesor_id as string;
    const persona = ev.profesores?.personas ?? null;
    const entry = map.get(pid) ?? {
      nombre: persona?.nombre ?? "",
      primer_apellido: persona?.primer_apellido ?? "",
      count: 0,
    };
    entry.count++;
    map.set(pid, entry);
  }
  const docentes: DocenteActividad[] = Array.from(map.entries())
    .map(([profesor_id, v]) => ({
      profesor_id,
      nombre: v.nombre,
      primer_apellido: v.primer_apellido,
      total_evaluaciones: v.count,
    }))
    .sort((a, b) => b.total_evaluaciones - a.total_evaluaciones);
  return { periodo, docentes };
}

function calcularCobertura(evaluaciones: any[], periodo: number): CoberturaResponse {
  const zonaMap = new Map<string, { nombre: string; evals: number; estudiantes: Set<string> }>();
  for (const ev of evaluaciones) {
    const zona =
      ev.aulas?.escuela?.zona ?? ev.estudiantes?.escuela?.zona ?? null;
    if (!zona) continue;
    const entry = zonaMap.get(zona.id) ?? { nombre: zona.nombre, evals: 0, estudiantes: new Set() };
    entry.evals++;
    entry.estudiantes.add(ev.estudiante_id);
    zonaMap.set(zona.id, entry);
  }
  const zonas: CoberturaZona[] = Array.from(zonaMap.entries())
    .map(([zona_id, v]) => ({
      zona_id,
      zona_nombre: v.nombre,
      evaluaciones: v.evals,
      estudiantes_evaluados: v.estudiantes.size,
    }))
    .sort((a, b) => a.zona_nombre.localeCompare(b.zona_nombre, "es"));
  const total_evaluaciones = zonas.reduce((s, z) => s + z.evaluaciones, 0);
  const total_estudiantes_evaluados = new Set(
    evaluaciones.map((e) => e.estudiante_id)
  ).size;
  return { periodo, zonas, total_evaluaciones, total_estudiantes_evaluados };
}

function pctFromMap(m: Map<string, { suma: number; count: number }>, areaId: string): number | null {
  const v = m.get(areaId);
  return v ? v.suma / v.count : null;
}

function calcularProgresion(
  evaluaciones: any[],
  reglasMap: Map<string, number>,
  areas: Array<{ id: string; nombre: string; orden: number }>,
  estudiante_id: string,
  nombre: string,
  primer_apellido: string,
  periodo: number | null
): ProgresionResponse {
  const areaEvals = new Map<string, ProgresoEval[]>();
  for (const ev of evaluaciones) {
    for (const ea of ev.evaluaciones_estudiante_area) {
      const max = reglasMap.get(`${ea.area_id}__${ev.sala_id}`) ?? null;
      const pct =
        max && max > 0 && ea.puntaje != null
          ? Math.min(1, Math.max(0, ea.puntaje / max))
          : null;
      const list = areaEvals.get(ea.area_id) ?? [];
      list.push({
        evaluacion_id: ev.id,
        fecha: new Date(ev.fecha_creacion).toISOString().split("T")[0],
        tipo: ev.tipo_id,
        pct,
      });
      areaEvals.set(ea.area_id, list);
    }
  }
  const areasResult: ProgresoArea[] = areas
    .filter((a) => areaEvals.has(a.id))
    .map((a) => ({
      area_id: a.id,
      area_nombre: a.nombre,
      area_orden: a.orden,
      evaluaciones: areaEvals.get(a.id)!,
    }));
  return { estudiante_id, nombre, primer_apellido, periodo, areas: areasResult };
}

function bucketPct(pct: number): number {
  if (pct <= 0.2) return 0;
  if (pct <= 0.4) return 1;
  if (pct <= 0.6) return 2;
  if (pct <= 0.8) return 3;
  return 4;
}

export class EstadisticasService {
  private repo = EstadisticasRepository;

  private validateRol(rol: string, ...rolesPermitidos: string[]) {
    if (!rolesPermitidos.includes(rol)) throw new Error("Acceso denegado");
  }

  private async getReglasMap() {
    const reglas = await this.repo.findReglasAprobacion();
    return buildReglasMap(reglas);
  }

  private async getAreasMap(): Promise<Map<string, string>> {
    const areas = await this.repo.findAreas();
    return new Map(areas.map((a: any) => [a.id, a.nombre as string]));
  }

  async evolucionPadi(params: { periodo: number; rol: string }): Promise<EvolucionResponse> {
    this.validateRol(params.rol, "equipo_padi");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evIni, evFin] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "inicial" }),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "final" }),
    ]);
    return calcularEvolucion(evIni, evFin, reglasMap, areas, params.periodo);
  }

  async evolucionZona(params: { periodo: number; rol: string; usuarioId: string }): Promise<EvolucionResponse> {
    this.validateRol(params.rol, "encargado_zona");
    const zonaId = await this.repo.findZonaIdDeEncargado(params.usuarioId);
    if (!zonaId) throw new Error("Encargado sin zona asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evIni, evFin] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "inicial", zonaId }),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "final", zonaId }),
    ]);
    return calcularEvolucion(evIni, evFin, reglasMap, areas, params.periodo);
  }

  async evolucionEscuela(params: { periodo: number; rol: string; escuelaId: string | null }): Promise<EvolucionResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evIni, evFin] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "inicial", escuelaId: params.escuelaId }),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: "final", escuelaId: params.escuelaId }),
    ]);
    return calcularEvolucion(evIni, evFin, reglasMap, areas, params.periodo);
  }

  async areasCriticasPadi(params: { periodo: number; tipo: string; rol: string }): Promise<AreasCriticasResponse> {
    this.validateRol(params.rol, "equipo_padi");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo }),
    ]);
    return calcularAreasCriticas(evaluaciones, reglasMap, areas, params.tipo, params.periodo);
  }

  async areasCriticasZona(params: { periodo: number; tipo: string; rol: string; usuarioId: string }): Promise<AreasCriticasResponse> {
    this.validateRol(params.rol, "encargado_zona");
    const zonaId = await this.repo.findZonaIdDeEncargado(params.usuarioId);
    if (!zonaId) throw new Error("Encargado sin zona asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo, zonaId }),
    ]);
    return calcularAreasCriticas(evaluaciones, reglasMap, areas, params.tipo, params.periodo);
  }

  async areasCriticasEscuela(params: { periodo: number; tipo: string; rol: string; escuelaId: string | null }): Promise<AreasCriticasResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo, escuelaId: params.escuelaId }),
    ]);
    return calcularAreasCriticas(evaluaciones, reglasMap, areas, params.tipo, params.periodo);
  }

  async estudiantesEnRiesgoZona(params: {
    periodo: number;
    umbral: number;
    rol: string;
    usuarioId: string;
  }): Promise<RiesgoResponse> {
    this.validateRol(params.rol, "encargado_zona");
    const zonaId = await this.repo.findZonaIdDeEncargado(params.usuarioId);
    if (!zonaId) throw new Error("Encargado sin zona asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areasMap, reglasMap, evaluaciones] = await Promise.all([
      this.getAreasMap(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaRiesgo({ periodoStart, periodoEnd, zonaId }),
    ]);
    return calcularRiesgo(evaluaciones, reglasMap, areasMap, params.umbral, params.periodo);
  }

  async estudiantesEnRiesgoEscuela(params: {
    periodo: number;
    umbral: number;
    rol: string;
    escuelaId: string | null;
  }): Promise<RiesgoResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areasMap, reglasMap, evaluaciones] = await Promise.all([
      this.getAreasMap(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaRiesgo({
        periodoStart,
        periodoEnd,
        escuelaId: params.escuelaId,
      }),
    ]);
    return calcularRiesgo(evaluaciones, reglasMap, areasMap, params.umbral, params.periodo);
  }

  async actividadDocentesZona(params: {
    periodo: number;
    rol: string;
    usuarioId: string;
  }): Promise<ActividadResponse> {
    this.validateRol(params.rol, "encargado_zona");
    const zonaId = await this.repo.findZonaIdDeEncargado(params.usuarioId);
    if (!zonaId) throw new Error("Encargado sin zona asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const evals = await this.repo.findActividadDocentes({ periodoStart, periodoEnd, zonaId });
    return calcularActividad(evals, params.periodo);
  }

  async actividadDocentesEscuela(params: {
    periodo: number;
    rol: string;
    escuelaId: string | null;
  }): Promise<ActividadResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const evals = await this.repo.findActividadDocentes({
      periodoStart,
      periodoEnd,
      escuelaId: params.escuelaId,
    });
    return calcularActividad(evals, params.periodo);
  }

  async coberturaPorZona(params: { periodo: number; rol: string }): Promise<CoberturaResponse> {
    this.validateRol(params.rol, "equipo_padi");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const evals = await this.repo.findEvaluacionesPorZona({ periodoStart, periodoEnd });
    return calcularCobertura(evals, params.periodo);
  }

  async comparativaEscuela(params: {
    periodo: number;
    tipo: string;
    rol: string;
    escuelaId: string | null;
  }): Promise<ComparativaResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const zonaId = await this.repo.findZonaIdDeEscuela(params.escuelaId);
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evEscuela, evZona, evNacional] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({
        periodoStart, periodoEnd, tipo: params.tipo, escuelaId: params.escuelaId,
      }),
      zonaId
        ? this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo, zonaId })
        : Promise.resolve([]),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo }),
    ]);
    const mapEsc = promediarPorArea(evEscuela, reglasMap);
    const mapZona = promediarPorArea(evZona as any[], reglasMap);
    const mapNac = promediarPorArea(evNacional, reglasMap);
    const areasResult: ComparativaArea[] = areas.map((a: any) => ({
      area_id: a.id,
      area_nombre: a.nombre,
      area_orden: a.orden,
      pct_escuela: pctFromMap(mapEsc, a.id),
      pct_zona: pctFromMap(mapZona, a.id),
      pct_nacional: pctFromMap(mapNac, a.id),
    }));
    return { periodo: params.periodo, tipo: params.tipo, areas: areasResult };
  }

  async progresionEstudianteDocente(params: {
    estudianteId: string;
    rol: string;
    usuarioId: string;
    aulaId?: string;
  }): Promise<ProgresionResponse> {
    this.validateRol(params.rol, "docente", "director", "encargado_zona", "equipo_padi");
    let persona: { nombre: string | null; primer_apellido: string | null } | null;
    if (params.rol === "docente") {
      const profesorId = await this.repo.findProfesorIdDeUsuario(params.usuarioId);
      if (!profesorId) throw new Error("No se encontró el perfil de docente");
      persona = await this.repo.findEstudianteEnAulasDeProfesor(params.estudianteId, profesorId);
      if (!persona) throw new Error("Estudiante no pertenece a tus aulas");
    } else {
      if (!params.aulaId) throw new Error("Se requiere aula_id");
      persona = await this.repo.findEstudianteEnAula(params.estudianteId, params.aulaId);
      if (!persona) throw new Error("Estudiante no pertenece a esta aula");
    }
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findUltimasEvaluaciones({ estudianteId: params.estudianteId, limit: 4 }),
    ]);
    return calcularProgresion(
      evaluaciones, reglasMap, areas,
      params.estudianteId, persona.nombre ?? "", persona.primer_apellido ?? "",
      null
    );
  }

  async progresionEstudianteEscuela(params: {
    estudianteId: string;
    rol: string;
    escuelaId: string | null;
  }): Promise<ProgresionResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const persona = await this.repo.findEstudianteEnEscuela(params.estudianteId, params.escuelaId);
    if (!persona) throw new Error("Estudiante no pertenece a esta escuela");
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findUltimasEvaluaciones({ estudianteId: params.estudianteId, limit: 4 }),
    ]);
    return calcularProgresion(
      evaluaciones, reglasMap, areas,
      params.estudianteId, persona.nombre ?? "", persona.primer_apellido ?? "",
      null
    );
  }

  async aprobacionPorPregunta(params: {
    periodo: number;
    aulaId: string;
    areaId: string | null;
    rol: string;
    usuarioId: string;
  }): Promise<AprobacionPreguntasResponse> {
    this.validateRol(params.rol, "docente", "director", "encargado_zona", "equipo_padi");
    if (params.rol === "docente") {
      const profesorId = await this.repo.findProfesorIdDeUsuario(params.usuarioId);
      if (!profesorId) throw new Error("No se encontró el perfil de docente");
      const tieneAcceso = await this.repo.findAulaDelProfesor(profesorId, params.aulaId);
      if (!tieneAcceso) throw new Error("No tenés acceso a esta aula");
    }

    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const evaluaciones = await this.repo.findRespuestasPorAula({
      aulaId: params.aulaId,
      periodoStart,
      periodoEnd,
      ...(params.areaId ? { areaId: params.areaId } : {}),
    });

    const map = new Map<string, { consigna: string | null; area_id: string | null; total: number; correctos: number }>();
    for (const ev of evaluaciones) {
      for (const area of ev.evaluaciones_estudiante_area) {
        for (const resp of area.evaluaciones_estudiante_area_preguntas) {
          const p = resp.preguntas;
          if (!p) continue;
          const entry = map.get(resp.pregunta_id) ?? {
            consigna: p.consigna ?? p.titulo ?? null,
            area_id: p.area_id ?? null,
            total: 0,
            correctos: 0,
          };
          entry.total++;
          if (resp.respuesta !== 0 && resp.respuesta !== null && resp.respuesta !== undefined) entry.correctos++;
          map.set(resp.pregunta_id, entry);
        }
      }
    }

    const items: ItemAprobacion[] = Array.from(map.entries())
      .map(([pregunta_id, v]) => ({
        pregunta_id,
        consigna: v.consigna,
        area_id: v.area_id,
        total: v.total,
        correctos: v.correctos,
        tasa_aprobacion: v.total > 0 ? v.correctos / v.total : 0,
      }))
      .sort((a, b) => a.tasa_aprobacion - b.tasa_aprobacion); // peores primero

    return { periodo: params.periodo, aula_id: params.aulaId, area_id: params.areaId, items };
  }

  async distribucionPuntajesDocente(params: {
    periodo: number;
    aulaId: string;
    rol: string;
    usuarioId: string;
  }): Promise<DistribucionResponse> {
    this.validateRol(params.rol, "docente", "director", "encargado_zona", "equipo_padi");
    if (params.rol === "docente") {
      const profesorId = await this.repo.findProfesorIdDeUsuario(params.usuarioId);
      if (!profesorId) throw new Error("No se encontró el perfil de docente");
      const tieneAcceso = await this.repo.findAulaDelProfesor(profesorId, params.aulaId);
      if (!tieneAcceso) throw new Error("No tenés acceso a esta aula");
    }

    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [evaluaciones, reglasMap] = await Promise.all([
      this.repo.findEvaluacionesParaAula({ aulaId: params.aulaId, periodoStart, periodoEnd }),
      this.getReglasMap(),
    ]);

    // Per student: collect avg pct per evaluation, then avg across evaluations
    const estudianteEvals = new Map<string, number[]>();
    for (const ev of evaluaciones) {
      const areas = ev.evaluaciones_estudiante_area;
      let sumaPct = 0, numAreas = 0;
      for (const a of areas) {
        const max = reglasMap.get(`${a.area_id}__${ev.sala_id}`) ?? null;
        if (!max || max === 0 || a.puntaje === null || a.puntaje === undefined) continue;
        sumaPct += Math.min(1, Math.max(0, a.puntaje / max));
        numAreas++;
      }
      if (numAreas === 0) continue;
      const evPct = sumaPct / numAreas;
      const list = estudianteEvals.get(ev.estudiante_id) ?? [];
      list.push(evPct);
      estudianteEvals.set(ev.estudiante_id, list);
    }

    const counts = [0, 0, 0, 0, 0];
    for (const evts of estudianteEvals.values()) {
      const avgPct = evts.reduce((a, b) => a + b, 0) / evts.length;
      counts[bucketPct(avgPct)]++;
    }

    return {
      periodo: params.periodo,
      aula_id: params.aulaId,
      total_estudiantes: estudianteEvals.size,
      rangos: RANGOS_DIST.map((r, i) => ({ ...r, cantidad: counts[i] })),
    };
  }

  async rendimientoPorNivelSocioeconomico(params: {
    periodo: number;
    tipo: string;
    rol: string;
  }): Promise<RendimientoNivelResponse> {
    this.validateRol(params.rol, "equipo_padi");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesPorNivelSocioeconomico({ periodoStart, periodoEnd, tipo: params.tipo }),
    ]);
    return calcularRendimientoNivel(evaluaciones, reglasMap, areas, params.tipo, params.periodo);
  }

  async heatmapZonas(params: {
    periodo: number;
    tipo: string;
    rol: string;
  }): Promise<HeatmapResponse> {
    this.validateRol(params.rol, "equipo_padi");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo }),
    ]);
    return armarHeatmap(evaluaciones, reglasMap, areas, "zona", params.periodo, params.tipo);
  }

  async heatmapEscuelas(params: {
    periodo: number;
    tipo: string;
    rol: string;
    usuarioId: string;
  }): Promise<HeatmapResponse> {
    this.validateRol(params.rol, "encargado_zona");
    const zonaId = await this.repo.findZonaIdDeEncargado(params.usuarioId);
    if (!zonaId) throw new Error("Encargado sin zona asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({ periodoStart, periodoEnd, tipo: params.tipo, zonaId }),
    ]);
    return armarHeatmap(evaluaciones, reglasMap, areas, "escuela", params.periodo, params.tipo);
  }

  async heatmapAulas(params: {
    periodo: number;
    tipo: string;
    rol: string;
    escuelaId: string | null;
  }): Promise<HeatmapResponse> {
    this.validateRol(params.rol, "director", "encargado_zona", "equipo_padi");
    if (!params.escuelaId) throw new Error("Director sin escuela asignada");
    const { periodoStart, periodoEnd } = getPeriodoRange(params.periodo);
    const [areas, reglasMap, evaluaciones] = await Promise.all([
      this.repo.findAreas(),
      this.getReglasMap(),
      this.repo.findEvaluacionesParaHeatmap({
        periodoStart,
        periodoEnd,
        tipo: params.tipo,
        escuelaId: params.escuelaId,
      }),
    ]);
    return armarHeatmap(evaluaciones, reglasMap, areas, "aula", params.periodo, params.tipo);
  }
}
