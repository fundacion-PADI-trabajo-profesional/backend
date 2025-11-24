import { EscuelasRepository } from "../repositories/escuela.repository";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

export class EscuelasService {
    private repo = EscuelasRepository;

    async create(data: CreateEscuelaDto, user: { id: string, rol: string }) {
        // Preparamos el objeto a guardar
        const payload: CreateEscuelaDto = {
            nombre: data.nombre,
            direccion: data.direccion,
            telefono: data.telefono
        };

        if (user.rol === "equipo_padi") {
            // Regla: PADI debe escribir la zona manualmente
            if (!data.zona) throw new Error("El equipo PADI debe especificar la zona de la escuela.");
            payload.zona = data.zona;
            // PADI podría asignar encargado_id si quisiera, pero por ahora lo dejamos opcional/null
        }
        else if (user.rol === "encargado_zona") {
            // Regla: Encargado NO elige zona, se usa la suya propia
            const encargadoData = await this.repo.findEncargadoProfile(user.id);

            if (!encargadoData) {
                throw new Error("No se encontró un perfil de encargado activo para tu usuario.");
            }

            payload.zona = encargadoData.zona;       // Hereda zona
            payload.encargado_id = encargadoData.id; // Se asigna a sí mismo
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
            // Encargado ve solo lo suyo
            const encargadoData = await this.repo.findEncargadoProfile(user.id);

            if (!encargadoData) {
                throw new Error("No se encontró perfil de encargado.");
            }

            return await this.repo.findByEncargadoId(encargadoData.id);
        }

        throw new Error("No tienes permisos para ver el listado de escuelas.");
    }

    async addDocente(escuelaId: string, profesorId: string) {
        //  agregar validaciones aca (ej: si la escuela existe)
        return await this.repo.addDocenteRelation(escuelaId, profesorId);
    }

    async removeDocente(escuelaId: string, profesorId: string) {
        return await this.repo.removeDocenteRelation(escuelaId, profesorId);
    }

}