export interface CreateEscuelaDto {
    nombre: string;
    direccion?: string;
    telefono?: string;
    zona_id: string;         // Requerido si quien crea es PADI
    encargado_id?: string; // Se autocompleta si quien crea es Encargado
}