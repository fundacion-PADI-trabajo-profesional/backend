// Archivo: estudiante.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"
const { v4: uuidv4 } = require('uuid'); // Asegúrate de tener uuid o usa crypto

type EvaluacionResumen = {
    inicial: string | null
    cierre: string | null
}

async function getEvaluacionesResumenPorEstudiantes(prismaAny: any, estudianteIds: string[]) {
    const resumen = new Map<string, EvaluacionResumen>()
    if (estudianteIds.length === 0) return resumen

    const rows = await prismaAny.evaluacionEstudiante.findMany({
        where: {
            estudiante_id: { in: estudianteIds },
            tipo_id: { in: ["inicial", "cierre"] },
        },
        select: {
            estudiante_id: true,
            tipo_id: true,
            estado_id: true,
            fecha_creacion: true,
        },
        orderBy: [
            { fecha_creacion: "desc" },
            { id: "desc" },
        ],
    })

    for (const row of rows) {
        const current = resumen.get(row.estudiante_id) || { inicial: null, cierre: null }
        if (row.tipo_id === "inicial" && current.inicial === null) current.inicial = row.estado_id
        if (row.tipo_id === "cierre" && current.cierre === null) current.cierre = row.estado_id
        resumen.set(row.estudiante_id, current)
    }

    return resumen
}

export interface CreateEstudianteData {
    dni: string
    nombre: string
    apellido: string // primer apellido
    fecha_nacimiento: string
    genero_id: string
    sala_id: number // id de la sala
    escuela_id: string // id de la escuela
    aula_id?: string // opcional para asignar estudiante al aula
    // segundo apellido opcional por ahora
}

export const EstudianteRepository = {
    async create(data: CreateEstudianteData) {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id } = data

        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available to create Estudiante")

        try {
            // Esta función ya usaba transacción y nombres plurales,
            // por eso probablemente siempre funcionó.
            const result = await prisma.$transaction(async (tx) => {
                const txAny = tx as any

                // Crear la persona (plural)
                const nuevaPersona = await txAny.personas.create({
                    data: {
                        dni,
                        nombre,
                        primer_apellido: apellido,
                        fecha_nacimiento: new Date(fecha_nacimiento),
                    },
                })

                // obtener la sala (plural)
                const sala = await txAny.salas.findUnique({
                    where: { id: sala_id },
                    select: { grado: true },
                })

                if (!sala) {
                    throw new Error("La sala seleccionada no existe")
                }

                // crear el estudiante (plural)
                const nuevoEstudiante = await txAny.estudiantes.create({
                    data: {
                        persona_id: nuevaPersona.id,
                        genero_id,
                        sala_id,
                        escuela_id,
                        grado: sala.grado,
                    },
                })

                if (aula_id) {
                    console.log("Insertando relación aula para aula_id:", aula_id);
                    await txAny.estudiantesAulas.create({
                        data: {
                            id: uuidv4(),
                            estudiante_id: nuevoEstudiante.id,
                            aula_id: aula_id,
                            fecha_inicio: new Date()
                        }
                    });
                }

                return await txAny.estudiantes.findUnique({
                    where: {
                        id: nuevoEstudiante.id
                    },
                    include: {
                        personas: true,
                        salas: true, // Prisma dice que 'salas' existe
                        escuela: true, // Prisma dice que 'escuela' existe
                        // CAMBIO AQUÍ: Según el log de error, el campo se llama 'aulas'
                        aulas: { 
                            where: {
                                fecha_fin: null
                            },
                            include: {
                                aula: {
                                    include: {
                                        sala: true // O 'salas' según tu modelo de Aulas
                                    }
                                }
                            }
                        }
                    }
                });
            })
            return result
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new Error("Ya existe un estudiante con ese DNI.")
                }
            }
            console.error("Error en transacción createEstudiante:", error)
            throw new Error("Error al crear el estudiante.")
        }
    },

    async list() {
        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available")
        const prismaAny = prisma as any
        const estudiantes = await prismaAny.estudiantes.findMany({
            include: {
                personas: {
                    select: {
                        nombre: true,
                        primer_apellido: true,
                        dni: true,
                    },
                },
                salas: {
                    select: { nombre: true, grado: true },
                },
                // AGREGAR ESTO:
                escuela: {
                    select: { nombre: true }
                },
                generos: { select: { descripcion: true } },
            },
        })

        const estudianteIds = estudiantes.map((e: any) => e.id)
        if (estudianteIds.length === 0) return estudiantes
        const resumenPorEstudiante = await getEvaluacionesResumenPorEstudiantes(prismaAny, estudianteIds)

        const asignacionesActivas = await prismaAny.estudiantesAulas.findMany({
            where: {
                estudiante_id: { in: estudianteIds },
                fecha_fin: null,
            },
            include: {
                aula: {
                    select: {
                        id: true,
                        comision: true,
                        turno: true,
                        sala_id: true,
                        sala: {
                            select: {
                                id: true,
                                nombre: true,
                                grado: true,
                            },
                        },
                    },
                },
            },
            orderBy: { fecha_inicio: "desc" },
        })

        const aulaActivaPorEstudiante = new Map<string, any>()
        for (const asignacion of asignacionesActivas) {
            if (!aulaActivaPorEstudiante.has(asignacion.estudiante_id)) {
                aulaActivaPorEstudiante.set(asignacion.estudiante_id, asignacion.aula)
            }
        }

        return estudiantes.map((est: any) => ({
            ...est,
            escuela: {
                escuela_id: est.escuela_id,
                nombre: est.escuela?.nombre ?? null,
            },
            evaluaciones_resumen: resumenPorEstudiante.get(est.id) ?? { inicial: null, cierre: null },
        }))
    },

    async getGeneros() {
        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available to fetch Géneros")

        try {
            // Mantenemos la transacción...
            return await prisma.$transaction(async (tx) => {
                const txAny = tx as any
                // ...pero usamos el nombre PLURAL correcto
                return await txAny.generos.findMany()
            })
        } catch (error) {
            console.error("Error en getGeneros:", error)
            throw new Error("Error al obtener géneros.")
        }
    },

    async getSalas() {
        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available to fetch Salas")

        try {
            // Mantenemos la transacción...
            return await prisma.$transaction(async (tx) => {
                const txAny = tx as any
                // ...pero usamos el nombre PLURAL correcto
                return await txAny.salas.findMany({
                    select: {
                        id: true,
                        nombre: true,
                        grado: true,
                    },
                })
            })
        } catch (error) {
            console.error("Error en getSalas:", error)
            throw new Error("Error al obtener salas.")
        }
    },
    async listByEscuela(escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const txAny = prisma as any;
        // Filtramos estudiantes que pertenezcan al UUID de la escuela proporcionado [cite: 17, 18]
        const estudiantes = await txAny.estudiantes.findMany({
            where: { escuela_id: escuelaId }, 
            include: {
                personas: {
                    select: { nombre: true, primer_apellido: true, dni: true },
                },
                salas: {
                    select: { nombre: true, grado: true },
                },
                escuela: {
                    select: { nombre: true }
                },
                generos: { select: { descripcion: true } },
            },
        });

        const estudianteIds = estudiantes.map((e: any) => e.id)
        if (estudianteIds.length === 0) return estudiantes
        const resumenPorEstudiante = await getEvaluacionesResumenPorEstudiantes(txAny, estudianteIds)

        const asignacionesActivas = await txAny.estudiantesAulas.findMany({
            where: {
                estudiante_id: { in: estudianteIds },
                fecha_fin: null,
            },
            include: {
                aula: {
                    select: {
                        id: true,
                        comision: true,
                        turno: true,
                        sala_id: true,
                        sala: {
                            select: {
                                id: true,
                                nombre: true,
                                grado: true,
                            },
                        },
                    },
                },
            },
            orderBy: { fecha_inicio: "desc" },
        })

        const aulaActivaPorEstudiante = new Map<string, any>()
        for (const asignacion of asignacionesActivas) {
            if (!aulaActivaPorEstudiante.has(asignacion.estudiante_id)) {
                aulaActivaPorEstudiante.set(asignacion.estudiante_id, asignacion.aula)
            }
        }

        return estudiantes.map((est: any) => ({
            ...est,
            escuela: {
                escuela_id: est.escuela_id,
                nombre: est.escuela?.nombre ?? null,
            },
            aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
            evaluaciones_resumen: resumenPorEstudiante.get(est.id) ?? { inicial: null, cierre: null },
        }))
    },

    async createBulk(estudiantesData: any[], commonData: { escuela_id: string, aula_id?: string }) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await (prisma as any).$transaction(async (tx: any) => {
            const creados = [];

            for (const est of estudiantesData) {
                // 1. Crear Persona
                const persona = await tx.personas.create({
                    data: {
                        dni: String(est.dni),
                        nombre: est.nombre,
                        primer_apellido: est.apellido,
                        fecha_nacimiento: new Date(est.fecha_nacimiento),
                    }
                });

                // 2. Crear Estudiante
                const nuevoEstudiante = await tx.estudiantes.create({
                    data: {
                        persona_id: persona.id,
                        genero_id: est.genero_id, // "M", "F", "X"
                        sala_id: Number(est.sala_id),
                        escuela_id: commonData.escuela_id,
                    }
                });

                // 3. Vincular a Aula si se proporcionó
                if (commonData.aula_id) {
                    await tx.estudiantesAulas.create({
                        data: {
                            id: crypto.randomUUID(),
                            estudiante_id: nuevoEstudiante.id,
                            aula_id: commonData.aula_id,
                            fecha_inicio: new Date()
                        }
                    });
                }
                creados.push(nuevoEstudiante);
            }
            return creados;
        });
    }
}