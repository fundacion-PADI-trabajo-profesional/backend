import { EstudianteRepository } from "../repositories/estudiante.repository"
import type { CreateEstudianteData } from "../interfaces/estudiante.interface"
import { getPrisma } from "../config/prismaClient"

export class EstudiantesService {
    private repo = EstudianteRepository

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

    async getGeneros(user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director" || user.rol === "encargado_zona" || user.rol === "equipo_padi") {
            return await this.repo.getGeneros()
        }
        throw new Error("No tienes permisos para ver el listado completo de estudiantes. Filtra por escuela.");
    }

    async getSalas(user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director" || user.rol === "encargado_zona" || user.rol === "equipo_padi") {
            return await this.repo.getSalas()
        }
        throw new Error("No tienes permisos para ver el listado completo de estudiantes. Filtra por escuela.");
    }

    async listByEscuela(escuelaId: string, user: { id: string; rol: string }) {
        if (user.rol === "docente" || user.rol === "director") {
            return await this.repo.listByEscuela(escuelaId);
        }
        throw new Error("No tienes permisos para acceder a los estudiantes de esta escuela.");
    }

    async createBulk(estudiantes: any[], commonData: { escuela_id: string, aula_id?: string }, user: { id: string; rol: string }) {
        if (user.rol !== "director" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para crear estudiantes en masa.");
        }
        return await this.repo.createBulk(estudiantes, commonData);
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

            const estudiante = await prismaAny.estudiantes.findUnique({
                where: { id },
                select: { escuela_id: true }
            });

            if (!estudiante) throw new Error("Estudiante no encontrado.");

            const escuelaDirector = user.escuela_id;
            if (!escuelaDirector || estudiante.escuela_id !== escuelaDirector) {
                throw new Error("No tienes permisos para modificar estudiantes de esta escuela.");
            }
        }

        return await this.repo.update(id, data);
    }

    async asignarEstudianteAula(estudianteId: string, aulaId: string, user: { id: string; rol: string }) {
        if (user.rol !== "director" && user.rol !== "encargado_zona" && user.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para asignar estudiantes a aulas.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        const estudiante = await prismaAny.estudiantes.findUnique({
            where: { id: estudianteId },
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
}
