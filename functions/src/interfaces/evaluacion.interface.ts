export interface CreateEvaluacionDTO {
  dni: string;           // DNI del estudiante
  tipo_id: string;       // 'inicial' o 'cierre'
  profesor_id: string;   // UUID del docente
  fecha_creacion: string; // ISO String o YYYY-MM
  aula_id?: string;      // UUID del aula (opcional pero recomendado para trazabilidad)
}

export interface AreaSummary {
  id: string;
  nombre: string;
  descripcion: string;
  estado_id: string;
  puntaje: number | null;
  aciertos_individuales?: number;
}