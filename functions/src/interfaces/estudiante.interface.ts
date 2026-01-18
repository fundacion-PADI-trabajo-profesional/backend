export interface CreateEstudianteData {
    dni: string
    nombre: string
    apellido: string // Se mapeará a primer_apellido
    fecha_nacimiento: string // Formato "YYYY-MM-DD"
    genero_id: string
    sala_id: number // id de la sala
    escuela_id: string // id de la escuela
}