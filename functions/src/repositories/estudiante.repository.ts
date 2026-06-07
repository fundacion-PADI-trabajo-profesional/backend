// Archivo: estudiante.repository.ts

import { Prisma } from "@prisma/client"
import { withRLSContext } from "../config/prismaClient"
import { validarSalaCompatible, inscribirConTraslado } from "../helpers/inscripcion.helper"
const { v4: uuidv4 } = require('uuid');

/**
 * Resumen de evaluaciones de un estudiante agrupadas por sala (año escolar).
 */
type EvaluacionAño = {
    sala_id: number
    sala_nombre: string | null
    inicial: string | null
    cierre: string | null
}

/**
 * Construye un mapa de historial de evaluaciones por estudiante.
 */
async function getEvaluacionesHistorialPorEstudiantes(tx: any, estudianteIds: string[]) {
    const historial = new Map<string, EvaluacionAño[]>()
    if (estudianteIds.length === 0) return historial

    const rows = await tx.evaluacionEstudiante.findMany({
        where: {
            estudiante_id: { in: estudianteIds },
            tipo_id: { in: ["inicial", "cierre"] },
        },
        select: {
            estudiante_id: true,
            tipo_id: true,
            estado_id: true,
            sala_id: true,
            salas: { select: { nombre: true } },
        },
        orderBy: [
            { fecha_creacion: "desc" },
            { id: "desc" },
        ],
    })

    for (const row of rows) {
        const entrada = historial.get(row.estudiante_id) ?? []
        let porSala = entrada.find(e => e.sala_id === row.sala_id)
        if (!porSala) {
            porSala = { sala_id: row.sala_id, sala_nombre: row.salas?.nombre ?? null, inicial: null, cierre: null }
            entrada.push(porSala)
        }
        if (row.tipo_id === "inicial" && porSala.inicial === null) porSala.inicial = row.estado_id
        if (row.tipo_id === "cierre" && porSala.cierre === null) porSala.cierre = row.estado_id
        historial.set(row.estudiante_id, entrada)
    }

    for (const [id, años] of historial) {
        historial.set(id, años.sort((a, b) => a.sala_id - b.sala_id))
    }

    return historial
}

export interface CreateEstudianteData {
    dni: string
    nombre: string
    apellido: string
    fecha_nacimiento: string
    genero_id: string
    sala_id: number
    escuela_id: string
    aula_id?: string
}

/**
 * Repositorio de acceso a datos para la entidad `Estudiante`.
 */
export const EstudianteRepository = {
  /**
   * Crea un estudiante nuevo en una transacción atómica.
   */
    async create(data: CreateEstudianteData) {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id } = data

        const includeEstudiante = {
            personas: true,
            salas: true,
            escuela: true,
            aulas: {
                where: { fecha_fin: null },
                include: { aula: { include: { sala: true } } }
            }
        }

        try {
            return await withRLSContext(async (tx) => {

                const personaExistente = await tx.personas.findUnique({
                    where: { dni },
                    include: { estudiantes: true }
                })

                if (personaExistente) {
                    const estudianteExistente = personaExistente.estudiantes[0]

                    if (!estudianteExistente || estudianteExistente.fecha_baja === null) {
                        throw new Error("Ya existe un estudiante activo con ese DNI.")
                    }

                    // Reactivar alumno dado de baja
                    const sala = await tx.salas.findUnique({
                        where: { id: sala_id },
                        select: { grado: true },
                    })
                    if (!sala) throw new Error("La sala seleccionada no existe")

                    await tx.personas.update({
                        where: { id: personaExistente.id },
                        data: { nombre, primer_apellido: apellido, fecha_nacimiento: new Date(fecha_nacimiento) }
                    })

                    await tx.estudiantes.update({
                        where: { id: estudianteExistente.id },
                        data: { fecha_baja: null, genero_id, sala_id, grado: sala.grado, escuela_id }
                    })

                    if (aula_id) {
                        const aulaDatos = await tx.aulas.findUnique({
                            where: { id: aula_id },
                            select: { sala_id: true, comision: true },
                        })
                        if (!aulaDatos) throw new Error("Aula no encontrada.")
                        validarSalaCompatible(sala_id, aulaDatos.sala_id, { aulaComision: aulaDatos.comision })
                        await inscribirConTraslado(tx, estudianteExistente.id, aula_id)
                    }

                    const estudianteReactivado = await tx.estudiantes.findUnique({
                        where: { id: estudianteExistente.id },
                        include: includeEstudiante
                    })
                    return { estudiante: estudianteReactivado, reactivado: true }
                }

                // Persona no existe → creación normal
                const nuevaPersona = await tx.personas.create({
                    data: { dni, nombre, primer_apellido: apellido, fecha_nacimiento: new Date(fecha_nacimiento) },
                })

                const sala = await tx.salas.findUnique({
                    where: { id: sala_id },
                    select: { grado: true },
                })
                if (!sala) throw new Error("La sala seleccionada no existe")

                const nuevoEstudiante = await tx.estudiantes.create({
                    data: { persona_id: nuevaPersona.id, genero_id, sala_id, escuela_id, grado: sala.grado },
                })

                if (aula_id) {
                    const aulaDatos = await tx.aulas.findUnique({
                        where: { id: aula_id },
                        select: { sala_id: true, comision: true },
                    })
                    if (!aulaDatos) throw new Error("Aula no encontrada.")
                    validarSalaCompatible(sala_id, aulaDatos.sala_id, { aulaComision: aulaDatos.comision })
                    await inscribirConTraslado(tx, nuevoEstudiante.id, aula_id)
                }

                const estudianteCreado = await tx.estudiantes.findUnique({
                    where: { id: nuevoEstudiante.id },
                    include: includeEstudiante
                })
                return { estudiante: estudianteCreado, reactivado: false }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new Error("Ya existe un estudiante con ese DNI.")
                }
            }
            if (error instanceof Error) throw error
            console.error("Error en transacción createEstudiante:", error)
            throw new Error("Error al crear el estudiante.")
        }
    },

  /**
   * Lista todos los estudiantes del sistema con escuela, sala, historial de evaluaciones
   * y aula activa.
   */
    async list() {
        return withRLSContext(async (tx) => {
            const estudiantes = await tx.estudiantes.findMany({
                where: { fecha_baja: null },
                include: {
                    personas: {
                        select: {
                            nombre: true,
                            primer_apellido: true,
                            dni: true,
                            fecha_nacimiento: true,
                        },
                    },
                    salas: {
                        select: { nombre: true, grado: true },
                    },
                    escuela: {
                        select: { nombre: true, zona: { select: { nombre: true } } }
                    },
                    generos: { select: { descripcion: true } },
                },
            })

            const estudianteIds = estudiantes.map((e: any) => e.id)
            if (estudianteIds.length === 0) return estudiantes
            const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(tx, estudianteIds)

            const asignacionesActivas = await tx.estudiantesAulas.findMany({
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
                    zona_nombre: est.escuela?.zona?.nombre ?? null,
                },
                aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
                evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
            }))
        })
    },

  /**
   * Retorna todos los géneros disponibles en el catálogo.
   */
    async getGeneros() {
        return withRLSContext(async (tx) => {
            return tx.generos.findMany()
        })
    },

  /**
   * Retorna todas las salas disponibles (id, nombre, grado).
   */
    async getSalas() {
        return withRLSContext(async (tx) => {
            return tx.salas.findMany({
                select: {
                    id: true,
                    nombre: true,
                    grado: true,
                },
            })
        })
    },

  /**
   * Lista los estudiantes de una escuela específica con sus datos enriquecidos.
   */
    async listByEscuela(escuelaId: string) {
        return withRLSContext(async (tx) => {
            const estudiantes = await tx.estudiantes.findMany({
                where: { escuela_id: escuelaId, fecha_baja: null },
                include: {
                    personas: {
                        select: { nombre: true, primer_apellido: true, dni: true, fecha_nacimiento: true },
                    },
                    salas: {
                        select: { nombre: true, grado: true },
                    },
                    escuela: {
                        select: { nombre: true, zona: { select: { nombre: true } } }
                    },
                    generos: { select: { descripcion: true } },
                },
            })

            const estudianteIds = estudiantes.map((e: any) => e.id)
            if (estudianteIds.length === 0) return estudiantes
            const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(tx, estudianteIds)

            const asignacionesActivas = await tx.estudiantesAulas.findMany({
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
                    zona_nombre: est.escuela?.zona?.nombre ?? null,
                },
                aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
                evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
            }))
        })
    },

  /**
   * Lista estudiantes de múltiples escuelas (para encargados de zona).
   */
    async listByEscuelas(escuelaIds: string[]) {
        return withRLSContext(async (tx) => {
            const estudiantes = await tx.estudiantes.findMany({
                where: { escuela_id: { in: escuelaIds }, fecha_baja: null },
                include: {
                    personas: {
                        select: { nombre: true, primer_apellido: true, dni: true, fecha_nacimiento: true },
                    },
                    salas: {
                        select: { nombre: true, grado: true },
                    },
                    escuela: {
                        select: { nombre: true, zona: { select: { nombre: true } } }
                    },
                    generos: { select: { descripcion: true } },
                },
            })

            const estudianteIds = estudiantes.map((e: any) => e.id)
            if (estudianteIds.length === 0) return estudiantes
            const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(tx, estudianteIds)

            const asignacionesActivas = await tx.estudiantesAulas.findMany({
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
                    zona_nombre: est.escuela?.zona?.nombre ?? null,
                },
                aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
                evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
            }))
        })
    },

  /**
   * Actualiza los datos de un estudiante existente en una transacción atómica.
   */
    async update(id: string, data: Partial<CreateEstudianteData>) {
        return withRLSContext(async (tx) => {
            // 1. Buscar el estudiante con su persona asociada
            const estudiante = await tx.estudiantes.findUnique({
                where: { id },
                include: { personas: true },
            })

            if (!estudiante) throw new Error("Estudiante no encontrado.")

            // 2. Actualizar datos de la persona
            await tx.personas.update({
                where: { id: estudiante.persona_id },
                data: {
                    ...(data.dni && { dni: data.dni }),
                    ...(data.nombre && { nombre: data.nombre }),
                    ...(data.apellido && { primer_apellido: data.apellido }),
                    ...(data.fecha_nacimiento != null && data.fecha_nacimiento !== ""
                        ? { fecha_nacimiento: new Date(data.fecha_nacimiento) }
                        : {}),
                },
            })

            // 3. Si cambia sala_id, recalcular el grado
            let nuevoGrado = estudiante.grado
            if (data.sala_id && data.sala_id !== estudiante.sala_id) {
                const sala = await tx.salas.findUnique({
                    where: { id: data.sala_id },
                    select: { grado: true },
                })
                if (!sala) throw new Error("La sala seleccionada no existe.")
                nuevoGrado = sala.grado
            }

            // 4. Actualizar el estudiante
            const actualizado = await tx.estudiantes.update({
                where: { id },
                data: {
                    ...(data.genero_id && { genero_id: data.genero_id }),
                    ...(data.sala_id && { sala_id: data.sala_id, grado: nuevoGrado }),
                    ...(data.escuela_id && { escuela_id: data.escuela_id }),
                },
                include: {
                    personas: true,
                    salas: true,
                    escuela: true,
                },
            })

            if (data.aula_id) {
                const aulaDatos = await tx.aulas.findUnique({
                    where: { id: data.aula_id },
                    select: { sala_id: true, comision: true },
                })
                if (!aulaDatos) throw new Error("Aula no encontrada.")
                const salaEfectiva: number = data.sala_id ?? estudiante.sala_id
                validarSalaCompatible(salaEfectiva, aulaDatos.sala_id, { aulaComision: aulaDatos.comision })
                await inscribirConTraslado(tx, id, data.aula_id)
            }

            return actualizado
        })
    },

  /**
   * Crea o actualiza estudiantes en lote a partir de una importación masiva.
   */
    async createBulk(estudiantesData: any[], commonData: { escuela_id: string, aula_id?: string }, user: any, dryRun: boolean = false) {
        // Si es dryRun, solo clasificamos sin abrir transacción de escritura completa
        if (dryRun) {
            return withRLSContext(async (tx) => {
                const resultados = { nuevos: [] as any[], promovidos: [] as any[], repitentes: [] as any[], retrocesos: [] as any[], reactivados: [] as any[] }

                for (const est of estudiantesData) {
                    const personaExistente = await tx.personas.findUnique({
                        where: { dni: String(est.dni) },
                        include: { estudiantes: true }
                    })

                    if (personaExistente && personaExistente.estudiantes.length > 0) {
                        const estudianteExistente = personaExistente.estudiantes[0]

                        if (estudianteExistente.fecha_baja !== null) {
                            resultados.reactivados.push(est)
                            continue
                        }

                        const oldSala = estudianteExistente.sala_id
                        const newSala = Number(est.sala_id)

                        est.old_sala_id = oldSala
                        if (newSala < oldSala) resultados.retrocesos.push(est)
                        else if (newSala > oldSala) resultados.promovidos.push(est)
                        else resultados.repitentes.push(est)
                    } else {
                        resultados.nuevos.push(est)
                    }
                }
                return resultados
            })
        }

        // Si NO es dryRun, procesamos fila por fila con transacción individual.
        // Los errores se acumulan sin abortar el lote.
        const procesados: any[] = []
        const errores: Array<{ fila: { dni: string; nombre: string; apellido: string }; motivo: string }> = []

        for (const est of estudiantesData) {
            try {
                await withRLSContext(async (tx) => {
                    const fechaNac = new Date(est.fecha_nacimiento)
                    if (isNaN(fechaNac.getTime())) {
                        throw new Error(`Fecha inválida para ${est.nombre} ${est.apellido}`)
                    }

                    // 1. Buscamos si la persona ya existe
                    const personaExistente = await tx.personas.findUnique({
                        where: { dni: String(est.dni) },
                        include: { estudiantes: true }
                    })

                    let estudianteId: string

                    if (personaExistente) {
                        // ACTUALIZACIÓN (Pase de año / Repetición / Reactivación)
                        const estudianteExistente = personaExistente.estudiantes[0]
                        estudianteId = estudianteExistente.id

                        const updateData: any = {
                            sala_id: Number(est.sala_id),
                            grado: Number(est.sala_id),
                            escuela_id: est.escuela_id || commonData.escuela_id,
                        }

                        if (estudianteExistente.fecha_baja !== null) {
                            updateData.fecha_baja = null
                            await tx.personas.update({
                                where: { id: personaExistente.id },
                                data: {
                                    nombre: est.nombre,
                                    primer_apellido: est.apellido,
                                    fecha_nacimiento: fechaNac,
                                }
                            })
                        }

                        await tx.estudiantes.update({
                            where: { id: estudianteId },
                            data: updateData,
                        })
                    } else {
                        // CREACIÓN (Alumno nuevo)
                        const persona = await tx.personas.create({
                            data: {
                                dni: String(est.dni),
                                nombre: est.nombre,
                                primer_apellido: est.apellido,
                                fecha_nacimiento: fechaNac,
                            }
                        })

                        const nuevoEstudiante = await tx.estudiantes.create({
                            data: {
                                persona_id: persona.id,
                                genero_id: est.genero_id,
                                sala_id: Number(est.sala_id),
                                grado: Number(est.sala_id),
                                escuela_id: est.escuela_id || commonData.escuela_id,
                            }
                        })
                        estudianteId = nuevoEstudiante.id
                    }

                    // 2. Vincular al aula con validación INV1 + traslado/idempotencia (INV2/INV3)
                    const aulaId = est.aula_id || commonData.aula_id
                    if (aulaId) {
                        const aulaDatos = await tx.aulas.findUnique({
                            where: { id: aulaId },
                            select: { sala_id: true, comision: true },
                        })
                        if (!aulaDatos) throw new Error("Aula no encontrada.")
                        validarSalaCompatible(Number(est.sala_id), aulaDatos.sala_id, { aulaComision: aulaDatos.comision })
                        await inscribirConTraslado(tx, estudianteId, aulaId)
                    }
                })
                procesados.push(est)
            } catch (error: any) {
                const motivo = error.code === 'P2003'
                    ? `El género o la sala no existen.`
                    : (error.message || 'Error desconocido.')
                errores.push({ fila: { dni: est.dni, nombre: est.nombre, apellido: est.apellido }, motivo })
            }
        }
        return { procesados, errores }
    }
}
