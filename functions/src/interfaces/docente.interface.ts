export interface DocenteItem {
    id: string;
    personas: {
        nombre: string | null;
        primer_apellido: string | null;
    };
}