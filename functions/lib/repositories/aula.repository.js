"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AulasRepository = void 0;
const prismaClient_1 = require("../config/prismaClient");
/**
 * Repositorio de acceso a datos para la entidad `Aula`.
 *
 * @remarks
 * Cada método obtiene la instancia de Prisma mediante `getPrisma()` y lanza
 * un error si la base de datos no está disponible (función Firebase en frío).
 * Los métodos de listado incluyen relaciones con `sala`, `escuela` y
 * `profesores_aulas` para evitar N+1 queries en los controladores.
 */
exports.AulasRepository = {
    /**
     * Crea un aula nueva en la base de datos.
     *
     * @param data - Datos del aula a crear.
     * @returns El registro de aula recién creado.
     * @throws Error si la base de datos no está disponible.
     */
    async create(data) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to create Aula");
        const prismaAny = prisma;
        const created = await prismaAny.aulas.create({
            data: {
                sala_id: data.sala_id,
                escuela_id: data.escuela_id,
                comision: data.comision,
                turno: data.turno,
            },
        });
        return created;
    },
    /**
     * Lista todas las aulas de una escuela, incluyendo sala y docentes asignados.
     *
     * @param escuela_id - UUID de la escuela.
     * @returns Array de aulas ordenadas por sala y comisión.
     * @throws Error si la base de datos no está disponible.
     */
    async listByEscuela(escuela_id) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to list Aulas");
        const prismaAny = prisma;
        const rows = await prismaAny.aulas.findMany({
            where: { escuela_id },
            include: {
                sala: {
                    select: {
                        id: true,
                        nombre: true,
                        grado: true,
                    },
                },
                profesores_aulas: {
                    select: {
                        profesor_id: true,
                        profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
                    },
                },
            },
            orderBy: [{ sala_id: "asc" }, { comision: "asc" }],
        });
        return rows;
    },
    /**
     * Actualiza los campos de un aula existente.
     *
     * @param id - UUID del aula a actualizar.
     * @param data - Campos a modificar (solo los presentes se actualizan).
     * @returns El registro de aula actualizado.
     * @throws Error si la base de datos no está disponible.
     */
    async update(id, data) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to update Aula");
        const prismaAny = prisma;
        const updated = await prismaAny.aulas.update({
            where: { id },
            data: {
                ...(data.sala_id !== undefined ? { sala_id: data.sala_id } : {}),
                ...(data.comision !== undefined ? { comision: data.comision } : {}),
                ...(data.turno !== undefined ? { turno: data.turno } : {}),
            },
        });
        return updated;
    },
    /**
     * Lista aulas de múltiples escuelas (para encargados de zona).
     *
     * @param escuela_ids - Array de UUIDs de escuelas.
     * @returns Array de aulas con datos de sala, escuela y docentes asignados.
     * @throws Error si la base de datos no está disponible.
     */
    async listByEscuelas(escuela_ids) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to list Aulas");
        const prismaAny = prisma;
        const rows = await prismaAny.aulas.findMany({
            where: { escuela_id: { in: escuela_ids } },
            include: {
                sala: {
                    select: {
                        id: true,
                        nombre: true,
                        grado: true,
                    },
                },
                escuela: {
                    select: {
                        id: true,
                        nombre: true,
                        zona: {
                            select: {
                                nombre: true,
                            },
                        },
                    },
                },
                profesores_aulas: {
                    select: {
                        profesor_id: true,
                        profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
                    },
                },
            },
            orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
        });
        return rows;
    },
    /**
     * Lista todas las aulas del sistema (uso exclusivo del rol `admin`).
     *
     * @returns Array de todas las aulas con datos de sala, escuela y docentes.
     * @throws Error si la base de datos no está disponible.
     */
    async listAll() {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to list Aulas");
        const prismaAny = prisma;
        const rows = await prismaAny.aulas.findMany({
            include: {
                sala: {
                    select: {
                        id: true,
                        nombre: true,
                        grado: true,
                    },
                },
                escuela: {
                    select: {
                        id: true,
                        nombre: true,
                        zona: {
                            select: {
                                nombre: true,
                            },
                        },
                    },
                },
                profesores_aulas: {
                    select: {
                        profesor_id: true,
                        profesor: { select: { personas: { select: { nombre: true, primer_apellido: true } } } },
                    },
                },
            },
            orderBy: [{ escuela_id: "asc" }, { sala_id: "asc" }, { comision: "asc" }],
        });
        return rows;
    },
    /**
     * Elimina un aula de la base de datos.
     *
     * @param id - UUID del aula a eliminar.
     * @throws Error si la base de datos no está disponible.
     */
    async delete(id) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to delete Aula");
        const prismaAny = prisma;
        await prismaAny.aulas.delete({ where: { id } });
    },
    /**
     * Lista las aulas asignadas a un docente, incluyendo los estudiantes activos
     * y el resumen de evaluaciones de cada uno.
     *
     * @remarks
     * Solo considera asignaciones activas (`fecha_fin: null`) tanto para
     * docente-aula como para estudiante-aula. El resumen de evaluaciones
     * expone el estado de la evaluación `"inicial"` y `"cierre"` más reciente.
     *
     * @param profesor_id - UUID del docente.
     * @returns Array de aulas con sus estudiantes activos y resumen de evaluaciones.
     * @throws Error si la base de datos no está disponible.
     */
    async listByProfesor(profesor_id) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to list docente aulas");
        const prismaAny = prisma;
        const asignaciones = await prismaAny.profesoresAulas.findMany({
            where: {
                profesor_id,
                fecha_fin: null,
            },
            include: {
                aula: {
                    include: {
                        sala: {
                            select: {
                                id: true,
                                nombre: true,
                                grado: true,
                            },
                        },
                        escuela: {
                            select: {
                                id: true,
                                nombre: true,
                            },
                        },
                        estudiantes_aulas: {
                            where: { fecha_fin: null },
                            include: {
                                estudiante: {
                                    include: {
                                        personas: {
                                            select: {
                                                id: true,
                                                nombre: true,
                                                primer_apellido: true,
                                                segundo_apellido: true,
                                                dni: true,
                                                fecha_nacimiento: true,
                                            },
                                        },
                                        generos: {
                                            select: {
                                                id: true,
                                                descripcion: true,
                                            },
                                        },
                                        salas: {
                                            select: {
                                                id: true,
                                                nombre: true,
                                                grado: true,
                                            },
                                        },
                                        escuela: {
                                            select: {
                                                id: true,
                                                nombre: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: [{ aula: { escuela_id: "asc" } }, { aula: { sala_id: "asc" } }, { aula: { comision: "asc" } }],
        });
        const byAulaId = new Map();
        for (const asignacion of asignaciones) {
            const aula = asignacion.aula;
            if (!aula || byAulaId.has(aula.id))
                continue;
            byAulaId.set(aula.id, {
                id: aula.id,
                sala_id: aula.sala_id,
                escuela_id: aula.escuela_id,
                comision: aula.comision,
                turno: aula.turno,
                fecha_creacion: aula.fecha_creacion,
                sala: aula.sala,
                escuela: aula.escuela,
                estudiantes: (aula.estudiantes_aulas || []).map((ea) => ea.estudiante),
            });
        }
        const aulas = Array.from(byAulaId.values());
        const estudianteIds = aulas.flatMap((aula) => (aula.estudiantes || []).map((e) => e.id));
        const resumenPorEstudiante = new Map();
        if (estudianteIds.length > 0) {
            const evalRows = await prismaAny.evaluacionEstudiante.findMany({
                where: {
                    estudiante_id: { in: estudianteIds },
                    tipo_id: { in: ["inicial", "cierre"] },
                },
                select: {
                    estudiante_id: true,
                    tipo_id: true,
                    estado_id: true,
                    fecha_creacion: true,
                    id: true,
                },
                orderBy: [{ fecha_creacion: "desc" }, { id: "desc" }],
            });
            for (const row of evalRows) {
                const current = resumenPorEstudiante.get(row.estudiante_id) || { inicial: null, cierre: null };
                if (row.tipo_id === "inicial" && current.inicial === null)
                    current.inicial = row.estado_id;
                if (row.tipo_id === "cierre" && current.cierre === null)
                    current.cierre = row.estado_id;
                resumenPorEstudiante.set(row.estudiante_id, current);
            }
        }
        return aulas.map((aula) => ({
            ...aula,
            estudiantes: (aula.estudiantes || []).map((est) => ({
                ...est,
                evaluaciones_resumen: resumenPorEstudiante.get(est.id) ?? { inicial: null, cierre: null },
            })),
        }));
    },
    /**
     * Lista los estudiantes actualmente asignados a un aula específica.
     *
     * @param aula_id - UUID del aula.
     * @returns Array de estudiantes con datos de persona, género, sala y escuela.
     * @throws Error si la base de datos no está disponible.
     */
    async listEstudiantesByAula(aula_id) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available to list aula students");
        const prismaAny = prisma;
        const asignaciones = await prismaAny.estudiantesAulas.findMany({
            where: {
                aula_id,
                fecha_fin: null,
            },
            include: {
                estudiante: {
                    include: {
                        personas: {
                            select: {
                                id: true,
                                nombre: true,
                                primer_apellido: true,
                                segundo_apellido: true,
                                dni: true,
                                fecha_nacimiento: true,
                            },
                        },
                        generos: {
                            select: {
                                id: true,
                                descripcion: true,
                            },
                        },
                        salas: {
                            select: {
                                id: true,
                                nombre: true,
                                grado: true,
                            },
                        },
                        escuela: {
                            select: {
                                id: true,
                                nombre: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ estudiante: { personas: { primer_apellido: "asc" } } }, { estudiante: { personas: { nombre: "asc" } } }],
        });
        return asignaciones.map((ea) => ea.estudiante);
    },
    /**
     * Agrega un estudiante a un aula creando un registro activo en `estudiantesAulas`.
     *
     * @param estudianteId - UUID del estudiante.
     * @param aulaId - UUID del aula destino.
     * @returns El registro de asignación creado.
     * @throws Error si el estudiante ya está asignado a ese aula o si la DB no está disponible.
     */
    async addEstudiante(estudianteId, aulaId) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available");
        const prismaAny = prisma;
        const existing = await prismaAny.estudiantesAulas.findFirst({
            where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
        });
        if (existing) {
            throw new Error("El estudiante ya está asignado a esta aula.");
        }
        return await prismaAny.estudiantesAulas.create({
            data: { estudiante_id: estudianteId, aula_id: aulaId },
        });
    },
    /**
     * Desasigna un estudiante de un aula estableciendo `fecha_fin` en la asignación activa.
     *
     * @remarks
     * El historial de asignaciones previas se conserva en la tabla `estudiantesAulas`.
     *
     * @param estudianteId - UUID del estudiante.
     * @param aulaId - UUID del aula.
     * @returns El registro de asignación con `fecha_fin` actualizada.
     * @throws Error si el estudiante no está asignado a ese aula o si la DB no está disponible.
     */
    async removeEstudiante(estudianteId, aulaId) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB not available");
        const prismaAny = prisma;
        const assignment = await prismaAny.estudiantesAulas.findFirst({
            where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
        });
        if (!assignment) {
            throw new Error("El estudiante no está asignado a esta aula.");
        }
        return await prismaAny.estudiantesAulas.update({
            where: { id: assignment.id },
            data: { fecha_fin: new Date() },
        });
    },
};
