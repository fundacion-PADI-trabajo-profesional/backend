import { EstudianteRepository } from "../repositories/estudiante.repository"
import type { CreateEstudianteData } from "../interfaces/estudiante.interface"
import { getPrisma } from "../config/prismaClient"

/**
 * Servicio de gestión de estudiantes y sus asignaciones a aulas.
 *
 * @remarks
 * Aplica control de acceso por rol en cada operación. Las reglas clave son:
 * - **Docentes**: solo pueden crear estudiantes en aulas que les están asignadas;
 *   `sala_id` y `escuela_id` se infieren del aula del docente para garantizar consistencia.
 * - **Directores**: solo pueden ver y modificar estudiantes de su propia escuela.
 * - **Encargados de zona**: ven estudiantes de todas las escuelas de su zona.
 * - **PADI**: acceso total.
 */
export class EstudiantesService {
    private repo = EstudianteRepository

    /**
     * Crea un estudiante nuevo con validaciones de rol.
     *
     * @remarks
     * Para docentes: verifica la asignación activa al aula y fuerza `sala_id`
     * y `escuela_id` desde el aula (ignora lo que venga en el body).
     * Para otros roles: requiere `escuela_id` y `sala_id` explícitos.
     *
     * @param data - Datos del estudiante a crear.
     * @param user - Usuario autenticado.
     * @returns El estudiante recién creado con sus relaciones.
     * @throws Error si el docente no está asignado al aula, faltan campos obligatorios,
     *         o el DNI ya existe.
     */
    async create(
        data: CreateEstudianteData,
        user: { id: string; rol: string },
    ) {
        // Validar permisos generales
        if (user) {
            if (user.rol !== "docente" && user.rol !== "director" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
                throw new Error("No tienes permisos para crear estudiantes.");
            }
        }

        if (user?.rol === "docente") {
            if (!data.aula_id) {
                throw new Error("Debes seleccionar un aula para registrar al estudiante.");
            }

            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const asignacion = await prismaAny.profesoresAulas.findFirst({
                where: {
                    profesor_id: user.id,
                    aula_id: data.aula_id,
                    fecha_fin: null,
                },
                include: {
                    aula: {
                        select: {
                            id: true,
                            sala_id: true,
                            escuela_id: true,
                        },
                    },
                },
            });

            if (!asignacion?.aula) {
                throw new Error("No tienes permisos para crear estudiantes en esta aula.");
            }

            // Forzamos consistencia con el aula asignada al docente.
            data.sala_id = asignacion.aula.sala_id;
            data.escuela_id = asignacion.aula.escuela_id;
        } else if (user?.rol === "equipo_padi" || user?.rol === "encargado_zona" || user?.rol === "director") {
            if (!data.escuela_id) {
                throw new Error("Debe especificar la escuela del estudiante.");
            }
            if (!data.sala_id) {
                throw new Error("Debe especificar la sala del estudiante.");
            }
        }

        return await this.repo.create(data)
    }

    /**
     * Lista estudiantes según el scope del rol del usuario.
     *
     * @remarks
     * - `"docente"`, `"director"`, `"equipo_padi"`: lista global (todos los estudiantes).
     * - `"encargado_zona"`: lista solo los estudiantes de las escuelas de su zona.
     *
     * @param user - Usuario autenticado.
     * @returns Array de estudiantes con aula activa e historial de evaluaciones.
     * @throws Error si el rol no tiene permisos de listado.
     */
    async list(user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director" || user.rol === "equipo_padi") {
            return await this.repo.list()
        }
        if (user.rol === "encargado_zona") {
            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                include: { zona: { include: { escuelas: { select: { id: true } } } } }
            });
            const escuelaIds = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];
            return await this.repo.listByEscuelas(escuelaIds);
        }
        
        throw new Error("No tienes permisos para ver el listado completo de estudiantes. Filtra por escuela.");
    }

    /**
     * Retorna el catálogo de géneros disponibles.
     *
     * @param user - Usuario autenticado (cualquier rol válido).
     * @returns Array de géneros del catálogo.
     * @throws Error si el rol no tiene acceso.
     */
    async getGeneros(user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director" || user.rol === "encargado_zona" || user.rol === "equipo_padi") {
            return await this.repo.getGeneros()
        }
        throw new Error("No tienes permisos para ver el listado completo de estudiantes. Filtra por escuela.");
    }

    /**
     * Retorna el catálogo de salas (años) disponibles.
     *
     * @param user - Usuario autenticado (cualquier rol válido).
     * @returns Array de `{ id, nombre, grado }`.
     * @throws Error si el rol no tiene acceso.
     */
    async getSalas(user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director" || user.rol === "encargado_zona" || user.rol === "equipo_padi") {
            return await this.repo.getSalas()
        }
        throw new Error("No tienes permisos para ver el listado completo de estudiantes. Filtra por escuela.");
    }

    /**
     * Lista los estudiantes de una escuela específica.
     *
     * @param escuelaId - UUID de la escuela.
     * @param user - Usuario autenticado (debe ser `"docente"` o `"director"`).
     * @returns Array de estudiantes enriquecidos.
     * @throws Error si el rol no tiene permisos de acceso filtrado por escuela.
     */
    async listByEscuela(escuelaId: string, user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director") {
            return await this.repo.listByEscuela(escuelaId);
        }
        throw new Error("No tienes permisos para acceder a los estudiantes de esta escuela.");
    }

    /**
     * Crea o actualiza estudiantes en lote (importación masiva).
     *
     * @remarks
     * Soporta modo `dryRun` para previsualizar la clasificación de estudiantes
     * (nuevos / promovidos / repitentes / retrocesos) sin persistir cambios.
     *
     * @param estudiantes - Array de datos de estudiantes.
     * @param commonData - Escuela y aula por defecto para todos.
     * @param user - Usuario autenticado (debe ser `"director"`, `"encargado_zona"` o `"equipo_padi"`).
     * @param dryRun - Si `true`, retorna clasificación sin escribir en la DB.
     * @returns Clasificación (en dryRun) o array de estudiantes procesados.
     * @throws Error si el rol no tiene permisos de importación masiva.
     */
    async createBulk(estudiantes: any[], commonData: { escuela_id: string, aula_id?: string }, user: { id: string; rol: string }, dryRun: boolean = false) {
        if (user.rol !== "director" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para crear estudiantes en masa.");
        }

        // NM1: encargado_zona solo puede importar a escuelas de su zona
        if (user.rol === "encargado_zona") {
            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                include: { zona: { include: { escuelas: { select: { id: true } } } } }
            });
            const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];

            if (!commonData.escuela_id || !escuelasDeZona.includes(commonData.escuela_id)) {
                throw new Error("No tienes permisos para importar estudiantes en esta escuela.");
            }
        }

        // NM1: director solo puede importar a su propia escuela
        if (user.rol === "director") {
            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const director = await prismaAny.usuarioPerfil.findUnique({
                where: { id: user.id },
                select: { escuela_id: true }
            });

            if (!director?.escuela_id || director.escuela_id !== commonData.escuela_id) {
                throw new Error("No tienes permisos para importar estudiantes en esta escuela.");
            }
        }

        return await this.repo.createBulk(estudiantes, commonData, user, dryRun);
    }

    /**
     * Actualizar datos de un estudiante.
     * Solo roles con acceso de gestión pueden modificar.
     * Directores solo pueden modificar estudiantes de su propia escuela.
     */
    async update(
        id: string,
        data: Partial<CreateEstudianteData>,
        user: { id: string; rol: string; escuela_id?: string }
    ) {
        const rolesPermitidos = ["director", "encargado_zona", "equipo_padi"];
        if (!rolesPermitidos.includes(user.rol)) {
            throw new Error("No tienes permisos para modificar datos de estudiantes.");
        }

        // Para directores, verificar que el estudiante pertenece a su escuela
        if (user.rol === "director") {
            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const estudiante = await prismaAny.estudiantes.findFirst({
                where: { id, fecha_baja: null },
                select: { escuela_id: true }
            });

            if (!estudiante) throw new Error("Estudiante no encontrado.");

            const escuelaDirector = user.escuela_id;
            if (!escuelaDirector || estudiante.escuela_id !== escuelaDirector) {
                throw new Error("No tienes permisos para modificar estudiantes de esta escuela.");
            }
        }

        // NH1: para encargado_zona, verificar que el estudiante pertenece a una escuela de su zona
        if (user.rol === "encargado_zona") {
            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const estudiante = await prismaAny.estudiantes.findFirst({
                where: { id, fecha_baja: null },
                select: { escuela_id: true }
            });

            if (!estudiante) throw new Error("Estudiante no encontrado.");

            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                include: { zona: { include: { escuelas: { select: { id: true } } } } }
            });
            const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];

            if (!escuelasDeZona.includes(estudiante.escuela_id)) {
                throw new Error("No tienes permisos para modificar estudiantes de esta zona.");
            }
        }

        return await this.repo.update(id, data);
    }

    /**
     * Asigna un estudiante a un aula con validaciones de escuela y rol.
     *
     * @remarks
     * Verifica que estudiante y aula pertenezcan a la misma escuela, y que el
     * usuario tenga permisos sobre esa escuela según su rol.
     *
     * @param estudianteId - UUID del estudiante.
     * @param aulaId - UUID del aula.
     * @param user - Usuario autenticado.
     * @returns El registro de asignación creado.
     * @throws Error si el estudiante ya está en el aula, pertenecen a escuelas distintas,
     *         o el usuario no tiene permisos.
     */
    async asignarEstudianteAula(estudianteId: string, aulaId: string, user: { id: string; rol: string }) {
        if (user.rol !== "director" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para asignar estudiantes a aulas.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        const estudiante = await prismaAny.estudiantes.findFirst({
            where: { id: estudianteId, fecha_baja: null },
            select: { id: true, escuela_id: true }
        });

        if (!estudiante) {
            throw new Error("Estudiante no encontrado.");
        }

        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true }
        });

        if (!aula) {
            throw new Error("Aula no encontrada.");
        }

        if (estudiante.escuela_id !== aula.escuela_id) {
            throw new Error("El estudiante y el aula deben pertenecer a la misma escuela.");
        }

        if (user.rol === "director") {
            const director = await prismaAny.usuarioPerfil.findUnique({
                where: { id: user.id },
                select: { escuela_id: true }
            });

            if (director?.escuela_id !== aula.escuela_id) {
                throw new Error("No tienes permisos para gestionar esta escuela.");
            }
        } else if (user.rol === "encargado_zona") {
            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                include: {
                    zona: {
                        include: {
                            escuelas: { select: { id: true } }
                        }
                    }
                }
            });

            const escuelasPermitidas = encargado?.zona?.escuelas.map((e: any) => e.id) || [];
            if (!escuelasPermitidas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar esta escuela.");
            }
        }
        // PADI puede asignar en cualquier escuela

        const asignacionExistente = await prismaAny.estudiantesAulas.findFirst({
            where: {
                estudiante_id: estudianteId,
                aula_id: aulaId,
                fecha_fin: null
            }
        });

        if (asignacionExistente) {
            throw new Error("El estudiante ya está asignado a esta aula.");
        }

        return await prismaAny.estudiantesAulas.create({
            data: {
                estudiante_id: estudianteId,
                aula_id: aulaId,
                fecha_inicio: new Date()
            }
        });
    }

    async desasignarEstudianteAula(estudianteId: string, aulaId: string, actor: { id: string; rol: string }) {
        if (actor.rol !== "director" && actor.rol !== "encargado_zona" && actor.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para desasignar estudiantes de aulas.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        const asignacion = await prismaAny.estudiantesAulas.findFirst({
            where: {
                estudiante_id: estudianteId,
                aula_id: aulaId,
                fecha_fin: null
            },
            include: {
                aula: { select: { escuela_id: true } }
            }
        });

        if (!asignacion) {
            throw new Error("No se encontró una asignación activa para este estudiante en esta aula.");
        }

        if (actor.rol === "director") {
            const director = await prismaAny.usuarioPerfil.findUnique({
                where: { id: actor.id },
                select: { escuela_id: true }
            });

            if (director?.escuela_id !== asignacion.aula.escuela_id) {
                throw new Error("No tienes permisos para gestionar esta escuela.");
            }
        } else if (actor.rol === "encargado_zona") {
            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: actor.id },
                include: {
                    zona: {
                        include: {
                            escuelas: { select: { id: true } }
                        }
                    }
                }
            });

            const escuelasPermitidas = encargado?.zona?.escuelas.map((e: any) => e.id) || [];
            if (!escuelasPermitidas.includes(asignacion.aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar esta escuela.");
            }
        }

        return await prismaAny.estudiantesAulas.updateMany({
            where: {
                estudiante_id: estudianteId,
                aula_id: aulaId,
                fecha_fin: null
            },
            data: { fecha_fin: new Date() }
        });
    }

    async delete(id: string, user: { id: string; rol: string }) {
        if (user.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para eliminar estudiantes.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        const estudiante = await prismaAny.estudiantes.findUnique({
            where: { id },
            select: { id: true, fecha_baja: true },
        });
        if (!estudiante) throw new Error("Estudiante no encontrado.");
        if (estudiante.fecha_baja) throw new Error("El estudiante ya fue dado de baja.");

        await prismaAny.estudiantes.update({
            where: { id },
            data: { fecha_baja: new Date() },
        });
    }
}
