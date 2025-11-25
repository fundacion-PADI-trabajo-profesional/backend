// Archivo: evaluacion.interface.ts
export interface CreateEvaluacionData {
  dni: string // Para buscar al estudiante
  tipo_id: string // Por ejemplo: "I" para Inicial, "C" para Cierre
  profesor_id: string // El profesor que crea la evaluación
}

export interface EvaluacionArea {
  id: 'CG' | 'CL' | 'SE' | 'SM'
  nombre: string
  descripcion: string
  orden: number
}

// Data de las áreas de evaluación que proporcionaste
export const EVALUACION_AREAS: EvaluacionArea[] = [
  { id: 'CG', nombre: 'Cognitiva', descripcion: 'Área de desarrollo de habilidades de pensamiento', orden: 3 },
  { id: 'CL', nombre: 'Comunicacion y Lenguaje', descripcion: 'Área de desarrollo de lenguaje y comunicación', orden: 2 },
  { id: 'SE', nombre: 'Socioemocional', descripcion: 'Área de desarrollo social y emocional', orden: 4 },
  { id: 'SM', nombre: 'Sensoriomotora', descripcion: 'Área de desarrollo sensorial y motor', orden: 1 },
]

// Estado inicial: 'N' (No Iniciada)
export const ESTADO_NO_INICIADA_ID = 'N'