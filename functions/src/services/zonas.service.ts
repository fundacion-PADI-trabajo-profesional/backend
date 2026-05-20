import { ZonasRepository } from "../repositories/zona.repository";
import { CreateZonaDto } from "../interfaces/zona.interface";

/**
 * Servicio de administración de zonas geográficas como divisón entre conjuntos de escuelas y asignación de escuelas.
 * * @remarks
 * Centraliza la organización territorial del sistema. Todas las operaciones 
 * están restringidas exclusivamente al personal con el rol `"equipo padi"`.
 */
export class ZonasService {
    private repo = ZonasRepository;

    /**
     * Valida si el rol del usuario tiene permisos de administración de zonas.
     * * @param rol - Rol del usuario a validar.
     * @throws Error si el rol es distinto a `"equipo_padi"`.
     */
    private validatePadi(rol: string) {
        if (rol !== "equipo_padi") {
            throw new Error("Acceso denegado: Solo el Equipo PADI puede gestionar zonas.");
        }
    }

    /**
     * Crea una nueva zona en el sistema.
     * * @param data - DTO con el nombre de la zona.
     * @param user - Usuario que realiza la petición.
     * @returns La zona creada.
     */
    async create(data: CreateZonaDto, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.create(data.nombre.trim());
    }


    /**
     * Recupera el listado completo de zonas registradas.
     * * @param user - Usuario que realiza la consulta para validación de rol.
     * @returns Array con todas las zonas y sus metadatos básicos.
     */
    async list(user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.listAll();
    }


    /**
     * Obtiene la información detallada de una zona, incluyendo sus escuelas y encargados.
     * * @param id - UUID de la zona.
     * @param user - Usuario que realiza la consulta.
     * @returns Objeto detallado de la zona.
     * @throws Error si la zona no existe en la base de datos.
     */
    async getDetails(id: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        const zona = await this.repo.findById(id);
        if (!zona) throw new Error("La zona no existe.");
        return zona;
    }

    /**
     * Asigna una escuela a una zona específica.
     * * @remarks
     * Este método permite vincular una escuela que se encuentra "sin zona" a una 
     * zona existente para su posterior gestión por encargados de zona.
     * * @param zonaId - UUID de la zona destino.
     * @param escuelaId - UUID de la escuela a asignar.
     * @param user - Usuario que realiza la petición.
     */
    async assignEscuela(zonaId: string, escuelaId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.assignEscuela(zonaId, escuelaId);
    }


    /**
     * Lista las instituciones educativas que actualmente no tienen una zona asignada.
     * * @remarks
     * Útil para el flujo de gestión territorial, permitiendo identificar escuelas 
     * "huérfanas" que requieren ser mapeadas a una zona.
     * * @param user - Usuario con rol autorizado.
     */
    async getEscuelasDisponibles(user: { rol: string }) {
        this.validatePadi(user.rol); // Reutilizamos tu validación de seguridad
        return await this.repo.listEscuelasSinZona();
    }


    /**
     * Desvincula una escuela de su zona actual.
     * * @remarks
     * La escuela no se elimina del sistema, simplemente vuelve al estado de 
     * "disponible" para ser asignada a otra zona si fuera necesario.
     * * @param escuelaId - UUID de la escuela a desasignar.
     * @param user - Usuario con rol autorizado.
     */
    async removeEscuelaFromZona(escuelaId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.unassignEscuela(escuelaId);
    }


    /**
     * Actualiza el nombre de una zona existente.
     * * @remarks
     * Realiza una validación de unicidad para evitar que el nuevo nombre 
     * colisione con otra zona ya existente en la base de datos.
     * * @param id - UUID de la zona a modificar.
     * @param data - Datos actualizados de la zona.
     * @param user - Usuario que realiza la petición.
     * @throws Error si el nombre ya está ocupado por otra zona.
     */
    async update(id: string, data: CreateZonaDto, user: { rol: string }) {
        this.validatePadi(user.rol);
        const nombreLimpio = data.nombre.trim();

        const existe = await this.repo.findByName(nombreLimpio);
        if (existe && existe.id !== id) {
            throw new Error(`Ya existe otra zona con el nombre '${nombreLimpio}'`);
        }

        return await this.repo.update(id, nombreLimpio);
    }


    /**
     * Lista los usuarios con rol de encargado que no tienen una zona asignada actualmente.
     * * @param user - Usuario con rol autorizado.
     * @returns Listado de encargados aptos para asignación.
     */
    async getEncargadosDisponibles(user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.listEncargadosDisponibles();
    }


    /**
     * Obtiene el listado de todos los encargados de zona registrados.
     * * @param user - Usuario con rol autorizado.
     */
    async getEncargados(user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.listEncargados();
    }


    /**
     * Asigna un usuario con rol encargado a una zona específica.
     * * @remarks
     * Permite establecer la responsabilidad administrativa de una zona a un usuario particular.
     * * @param zonaId - UUID de la zona destino.
     * @param encargadoId - UUID del usuario (encargado) a asignar.
     * @param user - Usuario (Equipo PADI) que realiza la operación.
     */
    async assignEncargadoToZona(zonaId: string, encargadoId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.assignEncargado(zonaId, encargadoId);
    }


    /**
     * Remueve la asignación de un encargado de su zona.
     * * @param encargadoId - UUID del usuario encargado.
     * @param user - Usuario con rol autorizado.
     */
    async removeEncargadoFromZona(encargadoId: string, user: { rol: string }) {
        this.validatePadi(user.rol);
        return await this.repo.unassignEncargado(encargadoId);
    }
}