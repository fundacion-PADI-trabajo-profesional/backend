export interface EncargadoItem {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    zona: {
        id: string;
        nombre: string;
    } | null;
}