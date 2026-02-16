export interface DocenteItem {
    id: string;
    personas: {
        nombre: string | null;
        primer_apellido: string | null;
    };
    profesores_aulas?: {
        aula: {
            id: string;
            comision: string;
            turno: string;
            sala?: {
                grado: number | null;
            } | null;
            escuela?: {
                nombre: string | null;
            } | null;
        };
    }[];
}