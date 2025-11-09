// Archivo: estudiante.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"

export interface CreateEstudianteData {
    dni: string
    nombre: string
    apellido: string // primer apellido
    fecha_nacimiento: string
    genero_id: string
    sala_id: number // id de la sala
    // segundo apellido opcional por ahora
}

export const EstudianteRepository = {
    async create(data: CreateEstudianteData) {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id } = data

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
                        grado: sala.grado,
                    },
                })

                return {
                    ...nuevoEstudiante,
                    persona: nuevaPersona,
                }
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
        if (!prisma) throw new Error("DB not available to fetch Estudiantes")

        try {
            // Mantenemos la transacción...
            const estudiantes = await prisma.$transaction(async (tx) => {
                const txAny = tx as any

                // ...pero usamos el nombre PLURAL correcto
                return await txAny.estudiantes.findMany({
                    include: {
                        personas: {
                            select: {
                                nombre: true,
                                primer_apellido: true,
                                segundo_apellido: true,
                                dni: true,
                            },
                        },
                        salas: {
                            select: {
                                nombre: true,
                                grado: true,
                            },
                        },
                        generos: {
                            select: {
                                descripcion: true,
                            },
                        },
                    },
                })
            })
            return estudiantes
        } catch (error) {
            console.error("Error en getAllEstudiantes:", error)
            throw new Error("Error al obtener la lista de estudiantes.")
        }
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
}