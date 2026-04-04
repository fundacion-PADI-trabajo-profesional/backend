import { EstudianteRepository } from "../repositories/estudiante.repository"
import type { CreateEstudianteData } from "../interfaces/estudiante.interface"
import { getPrisma } from "../config/prismaClient"


export class EstudiantesService {
    private repo = EstudianteRepository

    async create(
        data: CreateEstudianteData,
        actor?: { id: string; rol: string },
    ) {
        // Validar permisos generales
        if (actor) {
            if (actor.rol !== "docente" && actor.rol !== "director" && actor.rol !== "encargado_zona" && actor.rol !== "equipo_padi") {
                throw new Error("No tienes permisos para crear estudiantes.");
            }
        }

        if (actor?.rol === "docente") {
            if (!data.aula_id) {
                throw new Error("Debes seleccionar un aula para registrar al estudiante.");
            }

            const prisma = getPrisma();
            if (!prisma) throw new Error("DB not available");
            const prismaAny = prisma as any;

            const asignacion = await prismaAny.profesoresAulas.findFirst({
                where: {
                    profesor_id: actor.id,
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
        } else if (actor?.rol === "equipo_padi" || actor?.rol === "encargado_zona" || actor?.rol === "director") {
            // PADI, encargados y directores pueden crear estudiantes con más flexibilidad
            // pero deben especificar escuela_id y sala_id si no están ya establecidos
            if (!data.escuela_id) {
                throw new Error("Debe especificar la escuela del estudiante.");
            }
            if (!data.sala_id) {
                throw new Error("Debe especificar la sala del estudiante.");
            }
        }

        return await this.repo.create(data)
    }

    async list() {
        return await this.repo.list()
    }

    async getGeneros() {
        return await this.repo.getGeneros()
    }

    async getSalas() {
        return await this.repo.getSalas()
    }
    async listByEscuela(escuelaId: string) {
        // Llama al método que definiremos en el repositorio
        return await this.repo.listByEscuela(escuelaId);
    }

    async createBulk(estudiantes: any[], commonData: { escuela_id: string, aula_id?: string }, actor?: any) {      
        return await this.repo.createBulk(estudiantes, commonData);
    }
    async asignarEstudianteAula(estudianteId: string, aulaId: string, actor: { id: string; rol: string }) {
        // Validar permisos para asignar estudiantes a aulas
        if (actor.rol !== "director" && actor.rol !== "encargado_zona" && actor.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para asignar estudiantes a aulas.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        // Verificar que el estudiante existe
        const estudiante = await prismaAny.estudiantes.findUnique({
            where: { id: estudianteId },
            select: { id: true, escuela_id: true }
        });

        if (!estudiante) {
            throw new Error("Estudiante no encontrado.");
        }

        // Verificar que el aula existe
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true }
        });

        if (!aula) {
            throw new Error("Aula no encontrada.");
        }

        // Verificar que el estudiante y el aula pertenecen a la misma escuela
        if (estudiante.escuela_id !== aula.escuela_id) {
            throw new Error("El estudiante y el aula deben pertenecer a la misma escuela.");
        }

        // Para roles que no sean PADI, verificar permisos sobre la escuela
        if (actor.rol === "director") {
            const director = await prismaAny.usuarioPerfil.findUnique({
                where: { id: actor.id },
                select: { escuela_id: true }
            });

            if (director?.escuela_id !== aula.escuela_id) {
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
            if (!escuelasPermitidas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar esta escuela.");
            }
        }
        // PADI puede asignar en cualquier escuela

        // Verificar si ya existe una asignación activa
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

        // Crear la asignación
        return await prismaAny.estudiantesAulas.create({
            data: {
                estudiante_id: estudianteId,
                aula_id: aulaId,
                fecha_inicio: new Date()
            }
        });
    }

    async desasignarEstudianteAula(estudianteId: string, aulaId: string, actor: { id: string; rol: string }) {
        // Validar permisos para desasignar estudiantes de aulas
        if (actor.rol !== "director" && actor.rol !== "encargado_zona" && actor.rol !== "equipo_padi") {
            throw new Error("No tienes permisos para desasignar estudiantes de aulas.");
        }

        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        // Buscar la asignación activa
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

        // Verificar permisos sobre la escuela
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
        // PADI puede desasignar en cualquier escuela

        // Marcar la asignación como terminada
        return await prismaAny.estudiantesAulas.update({
            where: { id: asignacion.id },
            data: { fecha_fin: new Date() }
        });
    }

    async update(id: string, data: Partial<CreateEstudianteData>) {
        return await this.repo.update(id, data);
    }
}