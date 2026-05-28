// Archivo: estudiante.repository.ts

import { Prisma, PrismaClient } from "@prisma/client"
import { getPrisma } from "../config/prismaClient"
const { v4: uuidv4 } = require('uuid'); // Asegúrate de tener uuid o usa crypto

/**
 * Resumen de evaluaciones de un estudiante agrupadas por sala (año escolar).
 *
 * @remarks
 * Usado internamente por `getEvaluacionesHistorialPorEstudiantes` para
 * construir el historial de evaluaciones que se adjunta a cada estudiante
 * en los métodos de listado.
 */
type EvaluacionAño = {
    /** ID numérico de la sala (año escolar). */
    sala_id: number
    /** Nombre descriptivo de la sala (p. ej. `"Sala de 3 años"`). */
    sala_nombre: string | null
    /** Estado de la evaluación inicial en esa sala, o `null` si no existe. */
    inicial: string | null
    /** Estado de la evaluación de cierre en esa sala, o `null` si no existe. */
    cierre: string | null
}

/**
 * Construye un mapa de historial de evaluaciones por estudiante.
 *
 * @remarks
 * Para cada estudiante, agrupa los estados de evaluación `"inicial"` y `"cierre"`
 * por sala (año escolar), ordenados de menor a mayor `sala_id`.
 * Solo toma el estado más reciente por tipo/sala (ordenado por `fecha_creacion desc`).
 *
 * @param prismaAny - Instancia de Prisma sin tipado estricto.
 * @param estudianteIds - IDs de estudiantes para los que obtener el historial.
 * @returns Mapa `estudianteId → EvaluacionAño[]`.
 */
async function getEvaluacionesHistorialPorEstudiantes(prismaAny: any, estudianteIds: string[]) {
    const historial = new Map<string, EvaluacionAño[]>()
    if (estudianteIds.length === 0) return historial

    const rows = await prismaAny.evaluacionEstudiante.findMany({
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
    apellido: string // primer apellido
    fecha_nacimiento: string
    genero_id: string
    sala_id: number // id de la sala
    escuela_id: string // id de la escuela
    aula_id?: string // opcional para asignar estudiante al aula
    // segundo apellido opcional por ahora
}

/**
 * Repositorio de acceso a datos para la entidad `Estudiante`.
 *
 * @remarks
 * Los estudiantes se almacenan en tres tablas relacionadas:
 * - `personas`: datos de identidad (DNI, nombre, apellido, fecha de nacimiento).
 * - `estudiantes`: datos escolares (sala, escuela, género).
 * - `estudiantesAulas`: historial de asignaciones a aulas (con `fecha_fin` para el historial).
 *
 * Los métodos de listado adjuntan automáticamente `aula_asignada` (asignación activa)
 * y `evaluaciones_historial` (historial de evaluaciones por sala).
 */
export const EstudianteRepository = {
  /**
   * Crea un estudiante nuevo en una transacción atómica.
   *
   * @remarks
   * Orden de operaciones dentro de la transacción:
   * 1. Crea el registro en `personas`.
   * 2. Resuelve el grado a partir de la sala.
   * 3. Crea el registro en `estudiantes`.
   * 4. Si se provee `aula_id`, crea la asignación en `estudiantesAulas`.
   *
   * @param data - Datos del estudiante a crear.
   * @returns El estudiante recién creado con relaciones incluidas.
   * @throws Error con mensaje `"Ya existe un estudiante con ese DNI."` si el DNI está duplicado.
   */
    async create(data: CreateEstudianteData) {
        const { dni, nombre, apellido, fecha_nacimiento, genero_id, sala_id, escuela_id, aula_id } = data

        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available to create Estudiante")

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
            const result = await prisma.$transaction(async (tx) => {
                const txAny = tx as any

                const personaExistente = await txAny.personas.findUnique({
                    where: { dni },
                    include: { estudiantes: true }
                })

                if (personaExistente) {
                    const estudianteExistente = personaExistente.estudiantes[0]

                    if (!estudianteExistente || estudianteExistente.fecha_baja === null) {
                        throw new Error("Ya existe un estudiante activo con ese DNI.")
                    }

                    // Reactivar alumno dado de baja
                    const sala = await txAny.salas.findUnique({
                        where: { id: sala_id },
                        select: { grado: true },
                    })
                    if (!sala) throw new Error("La sala seleccionada no existe")

                    await txAny.personas.update({
                        where: { id: personaExistente.id },
                        data: { nombre, primer_apellido: apellido, fecha_nacimiento: new Date(fecha_nacimiento) }
                    })

                    await txAny.estudiantes.update({
                        where: { id: estudianteExistente.id },
                        data: { fecha_baja: null, genero_id, sala_id, grado: sala.grado, escuela_id }
                    })

                    if (aula_id) {
                        await txAny.estudiantesAulas.create({
                            data: { id: uuidv4(), estudiante_id: estudianteExistente.id, aula_id, fecha_inicio: new Date() }
                        })
                    }

                    const estudianteReactivado = await txAny.estudiantes.findUnique({
                        where: { id: estudianteExistente.id },
                        include: includeEstudiante
                    })
                    return { estudiante: estudianteReactivado, reactivado: true }
                }

                // Persona no existe → creación normal
                const nuevaPersona = await txAny.personas.create({
                    data: { dni, nombre, primer_apellido: apellido, fecha_nacimiento: new Date(fecha_nacimiento) },
                })

                const sala = await txAny.salas.findUnique({
                    where: { id: sala_id },
                    select: { grado: true },
                })
                if (!sala) throw new Error("La sala seleccionada no existe")

                const nuevoEstudiante = await txAny.estudiantes.create({
                    data: { persona_id: nuevaPersona.id, genero_id, sala_id, escuela_id, grado: sala.grado },
                })

                if (aula_id) {
                    await txAny.estudiantesAulas.create({
                        data: { id: uuidv4(), estudiante_id: nuevoEstudiante.id, aula_id, fecha_inicio: new Date() }
                    })
                }

                const estudianteCreado = await txAny.estudiantes.findUnique({
                    where: { id: nuevoEstudiante.id },
                    include: includeEstudiante
                })
                return { estudiante: estudianteCreado, reactivado: false }
            })
            return result
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
   *
   * @returns Array de estudiantes enriquecidos con `aula_asignada` y `evaluaciones_historial`.
   * @throws Error si la base de datos no está disponible.
   */
    async list() {
        const prisma = getPrisma()
        if (!prisma) throw new Error("DB not available")
        const prismaAny = prisma as any
        const estudiantes = await prismaAny.estudiantes.findMany({
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
        const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(prismaAny, estudianteIds)

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
                zona_nombre: est.escuela?.zona?.nombre ?? null,
            },
            aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
            evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
        }))
    },

  /**
   * Retorna todos los géneros disponibles en el catálogo.
   *
   * @returns Array de registros de la tabla `generos`.
   * @throws Error si la base de datos no está disponible.
   */
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

  /**
   * Retorna todas las salas disponibles (id, nombre, grado).
   *
   * @returns Array de `{ id, nombre, grado }` de la tabla `salas`.
   * @throws Error si la base de datos no está disponible.
   */
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
  /**
   * Lista los estudiantes de una escuela específica con sus datos enriquecidos.
   *
   * @param escuelaId - UUID de la escuela.
   * @returns Array de estudiantes con `aula_asignada` y `evaluaciones_historial`.
   * @throws Error si la base de datos no está disponible.
   */
    async listByEscuela(escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const txAny = prisma as any;
        // Filtramos estudiantes que pertenezcan al UUID de la escuela proporcionado [cite: 17, 18]
        const estudiantes = await txAny.estudiantes.findMany({
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
        });

        const estudianteIds = estudiantes.map((e: any) => e.id)
        if (estudianteIds.length === 0) return estudiantes
        const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(txAny, estudianteIds)

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
                zona_nombre: est.escuela?.zona?.nombre ?? null,
            },
            aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
            evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
        }))
    },

  /**
   * Lista estudiantes de múltiples escuelas (para encargados de zona).
   *
   * @remarks
   * Acepta un valor de tipo `string` pero lo usa con `{ in: escuelaId }`,
   * lo que en la práctica permite pasar un array de IDs.
   *
   * @param escuelaId - UUID o array de UUIDs de escuelas.
   * @returns Array de estudiantes enriquecidos.
   * @throws Error si la base de datos no está disponible.
   */
    async listByEscuelas(escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const txAny = prisma as any;
        const estudiantes = await txAny.estudiantes.findMany({
            where: { escuela_id: { in: escuelaId }, fecha_baja: null },
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
        });

        const estudianteIds = estudiantes.map((e: any) => e.id)
        if (estudianteIds.length === 0) return estudiantes
        const historialPorEstudiante = await getEvaluacionesHistorialPorEstudiantes(txAny, estudianteIds)

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
                zona_nombre: est.escuela?.zona?.nombre ?? null,
            },
            aula_asignada: aulaActivaPorEstudiante.get(est.id) ?? null,
            evaluaciones_historial: historialPorEstudiante.get(est.id) ?? [],
        }))
    },

  /**
   * Actualiza los datos de un estudiante existente en una transacción atómica.
   *
   * @remarks
   * Actualiza `personas` (DNI, nombre, apellido, fecha de nacimiento),
   * `estudiantes` (género, sala, escuela) y, si se provee `aula_id`,
   * cierra la asignación de aula activa y crea una nueva.
   *
   * @param id - UUID del estudiante a actualizar.
   * @param data - Campos a modificar (todos opcionales).
   * @returns El estudiante actualizado con relaciones incluidas.
   * @throws Error si el estudiante no existe o si la base de datos no está disponible.
   */
    async update(id: string, data: Partial<CreateEstudianteData>) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");
        const prismaAny = prisma as any;

        return await prismaAny.$transaction(async (tx: any) => {

            // 1. Buscar el estudiante con su persona asociada
            const estudiante = await tx.estudiantes.findUnique({
                where: { id },
                include: { personas: true },
            });

            if (!estudiante) throw new Error("Estudiante no encontrado.");

            // 2. Actualizar datos de la persona (dni, nombre, apellido, fecha_nacimiento)
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
            });

            // 3. Si cambia sala_id, recalcular el grado
            let nuevoGrado = estudiante.grado;
            if (data.sala_id && data.sala_id !== estudiante.sala_id) {
                const sala = await tx.salas.findUnique({
                    where: { id: data.sala_id },
                    select: { grado: true },
                });
                if (!sala) throw new Error("La sala seleccionada no existe.");
                nuevoGrado = sala.grado;
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
            });

            if (data.aula_id) {
                await tx.estudiantesAulas.updateMany({
                    where: {
                        estudiante_id: id,
                        fecha_fin: null,
                    },
                    data: {
                        fecha_fin: new Date(),
                    },
                });

                await tx.estudiantesAulas.create({
                    data: {
                        estudiante_id: id,
                        aula_id: data.aula_id,
                        fecha_inicio: new Date(),
                    },
                });
            }

            return actualizado;
        });
    },

  /**
   * Crea o actualiza estudiantes en lote a partir de una importación masiva.
   *
   * @remarks
   * Si `dryRun` es `true`, clasifica los estudiantes en cuatro categorías
   * (`nuevos`, `promovidos`, `repitentes`, `retrocesos`) sin escribir en la base de datos.
   * Si `dryRun` es `false`, ejecuta la carga real dentro de una transacción:
   * - Estudiantes nuevos: crea `personas` + `estudiantes`.
   * - Estudiantes existentes: actualiza sala, grado y escuela.
   * - En ambos casos, vincula al aula indicada en `commonData.aula_id` o `est.aula_id`.
   *
   * @param estudiantesData - Array de datos de estudiantes a procesar.
   * @param commonData - Datos comunes para todos (escuela y aula por defecto).
   * @param user - Usuario que ejecuta la operación (para auditoría futura).
   * @param dryRun - Si `true`, retorna la clasificación sin persistir cambios.
   * @returns En `dryRun`: `{ nuevos, promovidos, repitentes, retrocesos }`.
   *          En escritura real: array de estudiantes procesados.
   * @throws Error si algún estudiante tiene género o sala inválidos (código `P2003`).
   */
    async createBulk(estudiantesData: any[], commonData: { escuela_id: string, aula_id?: string }, user: any, dryRun: boolean = false) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        // Si es dryRun, solo clasificamos sin abrir transacción de escritura
        if (dryRun) {
            const resultados = { nuevos: [] as any[], promovidos: [] as any[], repitentes: [] as any[], retrocesos: [] as any[], reactivados: [] as any[] };

            for (const est of estudiantesData) {
                const personaExistente = await (prisma as any).personas.findUnique({
                    where: { dni: String(est.dni) },
                    include: { estudiantes: true }
                });

                if (personaExistente && personaExistente.estudiantes.length > 0) {
                    const estudianteExistente = personaExistente.estudiantes[0];

                    if (estudianteExistente.fecha_baja !== null) {
                        resultados.reactivados.push(est);
                        continue;
                    }

                    const oldSala = estudianteExistente.sala_id;
                    const newSala = Number(est.sala_id);

                    est.old_sala_id = oldSala;
                    if (newSala < oldSala) resultados.retrocesos.push(est);
                    else if (newSala > oldSala) resultados.promovidos.push(est);
                    else resultados.repitentes.push(est);
                } else {
                    resultados.nuevos.push(est);
                }
            }
            return resultados;
        }

        // Si NO es dryRun, guardamos de verdad
        return await (prisma as any).$transaction(async (tx: any) => {
            const procesados = [];

            for (const est of estudiantesData) {
                try {
                    const fechaNac = new Date(est.fecha_nacimiento);
                    if (isNaN(fechaNac.getTime())) {
                        throw new Error(`Fecha inválida para ${est.nombre} ${est.apellido}`);
                    }

                    // 1. Buscamos si la persona ya existe
                    const personaExistente = await tx.personas.findUnique({
                        where: { dni: String(est.dni) },
                        include: { estudiantes: true }
                    });

                    let estudianteId;

                    if (personaExistente) {
                        // ACTUALIZACIÓN (Pase de año / Repetición / Reactivación)
                        const estudianteExistente = personaExistente.estudiantes[0];
                        estudianteId = estudianteExistente.id;

                        const updateData: any = {
                            sala_id: Number(est.sala_id),
                            grado: Number(est.sala_id),
                            escuela_id: est.escuela_id || commonData.escuela_id,
                        };

                        if (estudianteExistente.fecha_baja !== null) {
                            // Reactivar alumno dado de baja y actualizar datos personales
                            updateData.fecha_baja = null;
                            await tx.personas.update({
                                where: { id: personaExistente.id },
                                data: {
                                    nombre: est.nombre,
                                    primer_apellido: est.apellido,
                                    fecha_nacimiento: fechaNac,
                                }
                            });
                        }

                        await tx.estudiantes.update({
                            where: { id: estudianteId },
                            data: updateData,
                        });
                    } else {
                        // CREACIÓN (Alumno nuevo)
                        const persona = await tx.personas.create({
                            data: {
                                dni: String(est.dni),
                                nombre: est.nombre,
                                primer_apellido: est.apellido,
                                fecha_nacimiento: fechaNac,
                            }
                        });

                        const nuevoEstudiante = await tx.estudiantes.create({
                            data: {
                                persona_id: persona.id,
                                genero_id: est.genero_id,
                                sala_id: Number(est.sala_id),
                                grado: Number(est.sala_id),
                                escuela_id: est.escuela_id || commonData.escuela_id,
                            }
                        });
                        estudianteId = nuevoEstudiante.id;
                    }

                    // 3. Vincular a la nueva Aula para mantener el historial
                    const aulaId = est.aula_id || commonData.aula_id;
                    if (aulaId) {
                        await tx.estudiantesAulas.create({
                            data: {
                                id: crypto.randomUUID(),
                                estudiante_id: estudianteId, // Usamos el ID recuperado (viejo o nuevo)
                                aula_id: aulaId,
                                fecha_inicio: new Date()
                            }
                        });
                    }
                    procesados.push(est);

                } catch (error: any) {
                    if (error.code === 'P2003') {
                        throw new Error(`Error en el alumno ${est.nombre}: El género o la sala no existen.`);
                    }
                    throw error; 
                }
            }
            return procesados;
        });
    }
}