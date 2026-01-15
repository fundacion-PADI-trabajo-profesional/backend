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
}