export interface CreateAulaDto {
  sala_id: number;   // id de la sala (3, 4, 5, etc.)
  comision: string;  // nombre de la comisión, ej: "Delfines"
  turno: string;     // "mañana", "tarde", etc.
  escuela_id?: string; // opcional, requerido para PADI y encargados
}


