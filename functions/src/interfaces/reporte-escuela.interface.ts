/**
 * Tipos del reporte de escuela (spec §5.4) y de la entrada del cálculo puro.
 * Campos del contrato en snake_case español, como todo el API.
 */

// ── Entrada del cálculo (lo que devuelve el repositorio) ─────────────────────

export interface EvaluacionReporteRow {
  id: string;
  estudiante_id: string;
  sala_id: number;
  /** `"inicial"` | `"cierre"` */
  tipo_id: string;
  /** `"A"` | `"D"` (el repositorio ya filtra E/N) */
  estado_id: string;
  fecha_creacion: Date;
  estudiantes: {
    personas: { nombre: string | null; primer_apellido: string | null; segundo_apellido: string | null };
  };
  evaluaciones_estudiante_area: { area_id: string; estado_id: string }[];
}

export interface RespuestaReporteRow {
  respuesta: number | null;
  evaluaciones_estudiante_area: { evaluacion_estudiante_id: string; area_id: string };
  preguntas: {
    id: string;
    numero: number | null;
    activa: boolean | null;
    puntaje_invertido: boolean | null;
    titulo: string | null;
    consigna: string | null;
  };
}

export interface CatalogosReporte {
  salas: { id: number; nombre: string | null }[];
  areas: { id: string; nombre: string | null; orden: number }[];
}

export interface ReporteInput {
  escuela: { id: string; nombre: string };
  periodo: number;
  generadoEn: Date;
  catalogos: CatalogosReporte;
  evaluaciones: EvaluacionReporteRow[];
  respuestas: RespuestaReporteRow[];
}

// ── Contrato de salida (`data` del ResponseModel) ─────────────────────────────

export interface AreaCatalogo { id: string; nombre: string; orden: number }

export interface PorArea { area_id: string; evaluados: number; aprobados: number }

export interface EstudianteResultado {
  estudiante_id: string;
  /** "Apellido Apellido2, Nombre" */
  nombre: string;
  aprobado: boolean;
  /** Estado por área; `null` = sin dato. */
  areas: Record<string, "A" | "D" | null>;
}

export interface PautaItem { numero: number | null; texto: string; desaprobaron: number; evaluados: number }
export interface PautasArea { area_id: string; items: PautaItem[] }

export interface CierraCon { aprobados: number; total: number }

export interface ResultadoTipo {
  evaluados: number;
  aprobados: number;
  /** Solo en cierre (§4.4); `null` en inicial. */
  cierra_con: CierraCon | null;
  por_area: PorArea[];
  estudiantes: EstudianteResultado[];
  pautas: PautasArea[];
}

export type EstadoAreaComparativo = "ok" | "recupero" | "persiste" | "nueva" | "pendiente";
export type ResultadoComparativo = "recupero" | "persiste" | "pendiente";

export interface EstudianteComparativo {
  estudiante_id: string;
  nombre: string;
  resultado: ResultadoComparativo;
  areas: Record<string, EstadoAreaComparativo>;
}

export interface PorAreaComparativo { area_id: string; aprobados_inicial: number; aprobados_cierre: number; sin_dato: number }

export interface Comparativo {
  base: number;
  aprobaron_inicial: number;
  reevaluados: number;
  recuperaron: number;
  persisten: number;
  pendientes: number;
  cierra_con: number;
  por_area: PorAreaComparativo[];
  /** Solo quienes no aprobaron la inicial (§4.5), orden §4.7. */
  estudiantes: EstudianteComparativo[];
  /** Las del cierre (denominador = reevaluados). */
  pautas: PautasArea[];
}

export interface SalaReporte {
  sala_id: number;
  sala: string;
  inicial: ResultadoTipo | null;
  cierre: ResultadoTipo | null;
  comparativo: Comparativo | null;
}

export interface ResumenPorSala { sala_id: number; sala: string; evaluados: number; aprobados: number; por_area: PorArea[] }
export interface ResumenTipo { evaluados: number; aprobados: number; por_area: PorArea[]; por_sala: ResumenPorSala[] }
export interface ResumenCierre extends ResumenTipo { cierra_con: CierraCon }

export interface ResumenComparativoSala {
  sala_id: number; sala: string; base: number; aprobaron_inicial: number;
  recuperaron: number; persisten: number; pendientes: number; cierra_con: number;
}
export interface ResumenComparativo {
  base: number; aprobaron_inicial: number; reevaluados: number;
  recuperaron: number; persisten: number; pendientes: number; cierra_con: number;
  por_area: { area_id: string; aprobados_inicial: number; aprobados_cierre: number }[];
  por_sala: ResumenComparativoSala[];
}

export interface ReporteEscuela {
  escuela: { id: string; nombre: string };
  periodo: number;
  /** ISO 8601 */
  generado_en: string;
  areas: AreaCatalogo[];
  salas: SalaReporte[];
  resumen: {
    inicial: ResumenTipo | null;
    cierre: ResumenCierre | null;
    comparativo: ResumenComparativo | null;
  };
}
