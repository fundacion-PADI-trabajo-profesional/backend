import { EscuelasRepository } from "../repositories/escuela.repository";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

export class EscuelasService {
    private repo = EscuelasRepository;

    async create(data: CreateEscuelaDto, user: { id: string, rol: string }) {
        // Preparamos el objeto a guardar
        const payload: CreateEscuelaDto = {
            nombre: data.nombre,
            direccion: data.direccion,
            telefono: data.telefono,
            zona_id: ""
        };

        if (user.rol === "equipo_padi") {
            // Regla: PADI debe escribir la zona manualmente
            if (!data.zona_id) throw new Error("El equipo PADI debe especificar la zona de la escuela.");
            payload.zona_id = data.zona_id;
            // PADI podría asignar encargado_id si quisiera, pero por ahora lo dejamos opcional/null
        }
        else if (user.rol === "encargado_zona") {
            // Regla: Encargado NO elige zona, se usa la suya propia
            const encargadoData = await this.repo.findEncargadoProfile(user.id);

            if (!encargadoData || !encargadoData.zona) {
                throw new Error("Tu perfil de encargado no tiene una zona válida asignada.");
            }

            payload.zona_id = encargadoData.zona.id; // Hereda el ID de su zona
            payload.encargado_id = encargadoData.id;
        }
        else {
            throw new Error("No tienes permisos para crear escuelas.");
        }

        return await this.repo.create(payload);
    }

    async list(user: { id: string, rol: string }) {
        if (user.rol === "equipo_padi") {
            // PADI ve todo
            return await this.repo.findAll();
        }

        if (user.rol === "encargado_zona") {
            // Encargado ve todas las escuelas de su zona
            const encargadoData = await this.repo.findEncargadoProfile(user.id);

            if (!encargadoData || !encargadoData.zona) {
                throw new Error("No se pudo determinar tu zona para listar las escuelas.");
            }

            return await this.repo.findByZona(encargadoData.zona.nombre);
        }

        throw new Error("No tienes permisos para ver el listado de escuelas.");
    }

    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string
    }) {
        return await this.repo.update(id, data);
    }

    async delete(id: string, user: { rol: string }) {
        // 1. Validación de seguridad: Solo el equipo PADI tiene este permiso
        if (user.rol !== "equipo_padi") {
            throw new Error("Acceso denegado. Solo el equipo PADI puede eliminar instituciones.");
        }

        // 2. Ejecutar la eliminación en el repositorio
        // El repositorio se encargará de setear escuela_id = null en los alumnos 
        // antes de borrar la escuela física.
        return await this.repo.delete(id);
    }

    async addDocente(escuelaId: string, profesorId: string) {
        return await this.repo.addDocenteRelation(escuelaId, profesorId);
    }

    async removeDocente(escuelaId: string, profesorId: string) {
        return await this.repo.removeDocenteRelation(escuelaId, profesorId);
    }

    async addDirectivo(escuelaId: string, usuarioId: string) {
        return await this.repo.addDirectivoRelation(escuelaId, usuarioId);
    }

    async removeDirectivo(usuarioId: string) {
        return await this.repo.removeDirectivoRelation(usuarioId);
    }

}