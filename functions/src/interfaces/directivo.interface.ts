export interface DirectivoItem {
    id: string;
    nombre: string;
    apellido: string;
    escuela?: {
        id: string;
        nombre: string;
    } | null;
}