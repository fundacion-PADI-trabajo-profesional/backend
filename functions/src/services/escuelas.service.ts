import { EscuelasRepository } from "../repositories/escuela.repository";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";
import { getPrisma } from "../config/prismaClient";
import { getEncargadoZonaId, escuelaPerteneceAZona } from "../utils/scope";

/**
 * Servicio de gestión de escuelas.
 *
 * @remarks
 * Aplica las reglas de negocio de scoping por rol:
 * - `"equipo_padi"`: acceso total (CRUD sobre cualquier escuela).
 * - `"encargado_zona"`: solo puede ver y modificar escuelas de su propia zona.
 *   Al crear, hereda automáticamente su `zona_id` y `encargado_id`.
 * - Otros roles: acceso denegado para operaciones de escritura y listado global.
 */
export class EscuelasService {
    private repo = EscuelasRepository;

    /**
     * Crea una escuela nueva aplicando las reglas de zona por rol.
     *
     * @remarks
     * - `"equipo_padi"`: debe proveer `zona_id` explícitamente.
     * - `"encargado_zona"`: la zona se obtiene de su perfil; no puede elegirla.
     *
     * @param data - DTO con los datos de la escuela.
     * @param user - Usuario autenticado.
     * @returns El registro de escuela creado.
     * @throws Error si la zona no está definida, el perfil de encargado no es válido,
     *         o el rol no tiene permisos de creación.
     */
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
        }
        else {
            throw new Error("No tienes permisos para crear escuelas.");
        }

        return await this.repo.create(payload);
    }

    /**
     * Lista escuelas con scope según el rol del usuario.
     *
     * @remarks
     * - `"equipo_padi"`: todas las escuelas.
     * - `"encargado_zona"`: solo las escuelas de su zona.
     *
     * @param user - Usuario autenticado.
     * @returns Array de escuelas con zona, directivos y docentes.
     * @throws Error si el encargado no tiene zona asignada o el rol no tiene permisos.
     */
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

        const escuelas = await this.repo.findByZonaId(encargadoData.zona_id);

        return escuelas;
    }

        if (user.rol === "director") {
            const prisma = getPrisma() as any;
            if (!prisma) throw new Error("DB not available");
            const perfil = await prisma.usuarioPerfil.findUnique({
                where: { id: user.id },
                select: { escuela_id: true },
            });
            if (!perfil?.escuela_id) throw new Error("El director no tiene una escuela asignada.");
            const escuela = await prisma.escuelas.findUnique({
                where: { id: perfil.escuela_id },
                include: {
                    zona: true,
                    directivos: { where: { rol: "director" }, select: { id: true, nombre: true, apellido: true } },
                    profesores_escuelas: {
                        where: { fecha_fin: null },
                        include: { profesor: { include: { personas: { select: { nombre: true, primer_apellido: true } } } } },
                    },
                    estudiantes: { include: { personas: true } },
                },
            });
            return escuela ? this.repo.mapEscuelaDocentes([escuela]) : [];
        }

        throw new Error("No tienes permisos para ver el listado de escuelas.");
    }

    /**
     * Actualiza los datos de una escuela.
     *
     * @param id - UUID de la escuela.
     * @param data - Nuevos valores para nombre, dirección, teléfono y zona.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"` o `"encargado_zona"`).
     * @returns El registro de escuela actualizado.
     * @throws Error si el rol no tiene permisos de modificación.
     */
    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string
    }, user: { id: string, rol: string }) {
        if (user.rol === "encargado_zona") {
            const zonaId = await getEncargadoZonaId(user.id);
            const pertenece = await escuelaPerteneceAZona(id, zonaId);
            if (!pertenece) throw new Error("No tenés permisos para modificar esta escuela.");
            // Impide que el encargado mueva la escuela a otra zona
            data.zona_id = zonaId;
            return await this.repo.update(id, data);
        }
        if (user.rol === "equipo_padi") {
            return await this.repo.update(id, data);
        }
        throw new Error("No tienes permisos para modificar data de escuelas.");
    }

    /**
     * Elimina una escuela del sistema (solo `"equipo_padi"`).
     *
     * @remarks
     * El repositorio desasigna estudiantes, directivos y docentes antes de
     * eliminar la escuela y sus aulas en una sola transacción.
     *
     * @param id - UUID de la escuela a eliminar.
     * @param user - Usuario autenticado.
     * @throws Error si el rol no es `"equipo_padi"`.
     */
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

    /**
     * Asigna un directivo a una escuela.
     *
     * @param escuelaId - UUID de la escuela.
     * @param usuarioId - UUID del directivo.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"` o `"encargado_zona"`).
     * @throws Error si el usuario no tiene permisos.
     */
    async addDirectivo(escuelaId: string, usuarioId: string, user: { id: string, rol: string }) {
        if (user.rol === "encargado_zona") {
            const zonaId = await getEncargadoZonaId(user.id);
            const pertenece = await escuelaPerteneceAZona(escuelaId, zonaId);
            if (!pertenece) throw new Error("No tenés permisos para asignar directivos en esa escuela.");
        } else if (user.rol !== "equipo_padi") {
            throw new Error("No tenés permisos para asignar directivos a escuelas.");
        }
        return await this.repo.addDirectivoRelation(escuelaId, usuarioId);
    }

    /**
     * Desasigna un directivo de su escuela poniendo `escuela_id = null`.
     *
     * @param usuarioId - UUID del directivo a desasignar.
     * @param user - Usuario autenticado (debe ser `"equipo_padi"` o `"encargado_zona"`).
     * @throws Error si el usuario no tiene permisos.
     */
    async removeDirectivo(usuarioId: string, user: { id: string, rol: string }) {
        if (user.rol === "encargado_zona") {
            const prismaAny = getPrisma() as any;
            if (!prismaAny) throw new Error("DB no disponible");
            const directivo = await prismaAny.usuarioPerfil.findUnique({
                where: { id: usuarioId },
                select: { escuela_id: true },
            });
            if (directivo?.escuela_id) {
                const zonaId = await getEncargadoZonaId(user.id);
                const pertenece = await escuelaPerteneceAZona(directivo.escuela_id, zonaId);
                if (!pertenece) throw new Error("No tenés permisos para desasignar directivos de esa escuela.");
            }
        } else if (user.rol !== "equipo_padi") {
            throw new Error("No tenés permisos para remover directivos de escuelas.");
        }
        return await this.repo.removeDirectivoRelation(usuarioId);
    }

}