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
            const encargadoData = await this.repo.findEncargadoProfile(user.id);
            if (!encargadoData?.zona_id) {
                throw new Error("No se encontró una zona asignada para el encargado.");
            }
            return await this.repo.findByZonaId(encargadoData.zona_id);
        }

        throw new Error("No tienes permisos para ver el listado de escuelas.");
    }

    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string
    }, user: { id: string, rol: string }) {
        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            // PADI puede actualizar todo, Encargado solo su zona (validado en repo)
            return await this.repo.update(id, data);
        }

        throw new Error("No tienes permisos para ver modificar data de escuelas.");
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

    async addDirectivo(escuelaId: string, usuarioId: string, user: { id: string, rol: string }) {
        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return await this.repo.addDirectivoRelation(escuelaId, usuarioId);
        }
        throw new Error("No tenés permisos para asignar directivos a escuelas.");
    }

    async removeDirectivo(usuarioId: string, user: { id: string, rol: string }) {
        if (user.rol === "equipo_padi" || user.rol === "encargado_zona") {
            return await this.repo.removeDirectivoRelation(usuarioId);
        }
        throw new Error("No tenés permisos para remover directivos de escuelas.");
    }

}