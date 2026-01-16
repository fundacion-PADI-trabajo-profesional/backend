import { ZonasRepository } from "../repositories/zona.repository";
import { CreateZonaDto } from "../interfaces/zona.interface";

export class ZonasService {
    private repo = ZonasRepository;

    private validatePadi(rol: string) {
        if (rol !== "equipo_padi") {
            throw new Error("Acceso denegado: Solo el Equipo PADI puede gestionar zonas.");
        }
    }

    async create(data: CreateZonaDto, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.create(data.nombre.trim());
    }

    async list(user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.listAll();
    }

    async getDetails(id: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        const zona = await this.repo.findById(id);
        if (!zona) throw new Error("La zona no existe.");
        return zona;
    }

    async assignEscuela(zonaId: string, escuelaId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.assignEscuela(zonaId, escuelaId);
    }

    async getEscuelasDisponibles(user: { rol: string }) {
        this.validatePadi(user.rol); // Reutilizamos tu validación de seguridad
        return await this.repo.listEscuelasSinZona();
    }

    async removeEscuelaFromZona(escuelaId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.unassignEscuela(escuelaId);
    }

    async update(id: string, data: CreateZonaDto, user: { rol: string }) {
        this.validatePadi(user.rol);
        const nombreLimpio = data.nombre.trim();

        const existe = await this.repo.findByName(nombreLimpio);
        if (existe && existe.id !== id) {
            throw new Error(`Ya existe otra zona con el nombre '${nombreLimpio}'`);
        }

        return await this.repo.update(id, nombreLimpio);
    }

    async getEncargadosDisponibles(user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.listEncargadosDisponibles();
    }

    async assignEncargadoToZona(zonaId: string, encargadoId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.assignEncargado(zonaId, encargadoId);
    }

    async removeEncargadoFromZona(encargadoId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.unassignEncargado(encargadoId);
    }
}