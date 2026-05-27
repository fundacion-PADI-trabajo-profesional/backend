import { getPrisma } from "../config/prismaClient";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

/**
 * Repositorio de acceso a datos para la entidad `Escuela`.
 *
 * @remarks
 * Centraliza todas las operaciones de lectura y escritura sobre la tabla `escuelas`
 * y sus relaciones (zonas, directivos, docentes, estudiantes).
 * Las listas de docentes se procesan con `mapEscuelaDocentes` para aplanar
 * la relación `profesores_escuelas` en un array `profesores` más simple.
 */
export const EscuelasRepository = {
  /**
   * Busca el registro de encargado de zona a partir del UUID de usuario.
   *
   * @param usuarioId - UUID del usuario en `usuarioPerfil`.
   * @returns El encargado con su zona incluida, o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
    async findEncargadoProfile(usuarioId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        return await prisma.encargados.findUnique({
            where: { usuario_id: usuarioId },
            include: {
                zona: true
            }
        });
    },

  /**
   * Crea una escuela nueva en la base de datos.
   *
   * @param data - DTO con los datos de la escuela a crear.
   * @returns El registro de escuela recién creado.
   * @throws Error si la creación falla (p. ej. clave foránea inválida).
   */
    async create(data: CreateEscuelaDto) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        try {
            return await prisma.escuelas.create({
                data: {
                    nombre: data.nombre,
                    direccion: data.direccion,
                    telefono: data.telefono,
                    zona_id: data.zona_id,
                    ...(data.nivel_socioeconomico && { nivel_socioeconomico: data.nivel_socioeconomico as any }),
                }
            });
        } catch (error: any) {
            console.error("Error repository create escuela:", error);
            throw new Error("Error al crear la escuela en base de datos.");
        }
    },

  /**
   * Elimina una escuela en una transacción atómica.
   *
   * @remarks
   * Orden de operaciones:
   * 1. Desasigna estudiantes (`escuela_id → null`).
   * 2. Desasigna directivos (`escuela_id → null`).
   * 3. Cierra asignaciones docentes (`fecha_fin = now`).
   * 4. Elimina todas las aulas de la escuela.
   * 5. Elimina la escuela.
   *
   * @param id - UUID de la escuela a eliminar.
   * @returns El registro de escuela eliminado.
   */
    async delete(id: string) {
        const prisma = getPrisma();

        return await (prisma as any).$transaction(async (tx: any) => {
            // 1. Dejar a los estudiantes de esta escuela sin escuela
            await tx.estudiantes.updateMany({
                where: { escuela_id: id },
                data: { escuela_id: null }
            });

            // 2. Desasignar directivos de esta escuela
            await tx.usuarioPerfil.updateMany({
                where: {
                    escuela_id: id,
                    rol: "director"
                },
                data: { escuela_id: null }
            });

            // 3. Cerrar asignaciones docentes de esta escuela
            await tx.profesoresEscuelas.updateMany({
                where: {
                    escuela_id: id,
                    fecha_fin: null,
                },
                data: {
                    fecha_fin: new Date(),
                },
            });

            await tx.aulas.deleteMany({
                where: { escuela_id: id }
            });

            return await tx.escuelas.delete({
                where: { id }
            });
        });
    },

  /**
   * Transforma el array crudo de Prisma aplanando la relación `profesores_escuelas`
   * en un campo `profesores` con `{ id, personas }` por escuela.
   *
   * @param data - Array de escuelas devuelto por Prisma con `profesores_escuelas` incluido.
   * @returns El mismo array con el campo `profesores` agregado.
   */
    mapEscuelaDocentes(data: any[]) {
        return data.map((escuela) => ({
            ...escuela,
            profesores: (escuela.profesores_escuelas || [])
                .filter((pe: any) => pe.profesor)
                .map((pe: any) => ({
                    id: pe.profesor.id,
                    personas: pe.profesor.personas,
                })),
        }));
    },

  /**
   * Actualiza los datos editables de una escuela.
   *
   * @param id - UUID de la escuela a actualizar.
   * @param data - Nuevos valores para nombre, dirección, teléfono y zona.
   * @returns El registro de escuela actualizado.
   * @throws Error si la actualización falla (p. ej. zona_id inválida).
   */
    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string;
        nivel_socioeconomico?: string;
    }) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        try {
            return await prisma.escuelas.update({
                where: { id },
                data: {
                    nombre: data.nombre,
                    direccion: data.direccion,
                    telefono: data.telefono,
                    zona_id: data.zona_id,
                    ...(data.nivel_socioeconomico && { nivel_socioeconomico: data.nivel_socioeconomico as any }),
                }
            });
        } catch (error: any) {
            console.error("Error repository update escuela:", error);
            // Si el error es porque la zona_id no existe, Prisma lanzará una excepción de clave foránea
            throw new Error("Error al actualizar la escuela en base de datos.");
        }
    },

  /**
   * Lista todas las escuelas del sistema con zona, directivos, docentes y estudiantes.
   *
   * @remarks
   * Uso exclusivo del rol `admin`. Puede devolver un dataset grande.
   *
   * @returns Array de escuelas procesado por `mapEscuelaDocentes`, ordenado por fecha de creación.
   * @throws Error si la base de datos no está disponible.
   */
    async findAll() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const rows = await prisma.escuelas.findMany({
            include: {
                zona: true,
                directivos: {
                    where: { rol: 'director' },
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
                profesores_escuelas: {
                    where: { fecha_fin: null },
                    include: {
                        profesor: {
                            include: {
                                personas: { select: { nombre: true, primer_apellido: true } },
                            },
                        },
                    }
                },
                estudiantes: {
                    include: {
                        personas: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return this.mapEscuelaDocentes(rows);
    },

  /**
   * Lista las escuelas de una zona específica.
   *
   * @param zonaId - UUID de la zona.
   * @returns Array de escuelas con zona, directivos, docentes y estudiantes.
   * @throws Error si la base de datos no está disponible.
   */
    async findByZonaId(zonaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const rows = await prisma.escuelas.findMany({
            where: { zona_id: zonaId },
            include: {
                zona: true,
                directivos: {
                    where: { rol: "director" },
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
                profesores_escuelas: {
                    where: { fecha_fin: null },
                    include: {
                        profesor: {
                            include: {
                                personas: { select: { nombre: true, primer_apellido: true } },
                            },
                        },
                    },
                },
                estudiantes: {
                    include: {
                        personas: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return this.mapEscuelaDocentes(rows);
    },

  /**
   * Lista las escuelas de una zona buscada por nombre.
   *
   * @param nombreZona - Nombre exacto de la zona.
   * @returns Array de escuelas con zona, directivos y estudiantes.
   * @throws Error si la base de datos no está disponible.
   */
    async findByZona(nombreZona: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const rows = await prisma.escuelas.findMany({
            where: {
                zona: {
                    nombre: nombreZona
                }
            },
            include: {
                zona: true, // Incluimos para que el front reciba el objeto
                directivos: {
                    where: { rol: 'director' },
                    select: { id: true, nombre: true, apellido: true },
                },
                estudiantes: {
                    include: {
                        personas: true // Para traer nombre, apellido y DNI
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return this.mapEscuelaDocentes(rows);
    },

  /**
   * Crea una relación docente-escuela si no existe una activa.
   *
   * @param escuelaId - UUID de la escuela.
   * @param profesorId - UUID del docente.
   */
    async addDocenteRelation(escuelaId: string, profesorId: string) {
        const prisma = getPrisma();
        const prismaAny = prisma as any;

        return await prismaAny.$transaction(async (tx: any) => {
            const existing = await tx.profesoresEscuelas.findFirst({
                where: {
                    profesor_id: profesorId,
                    escuela_id: escuelaId,
                    fecha_fin: null,
                },
            });

            if (!existing) {
                await tx.profesoresEscuelas.create({
                    data: {
                        profesor_id: profesorId,
                        escuela_id: escuelaId,
                    },
                });
            }
        });
    },

  /**
   * Cierra la relación docente-escuela y desasigna el docente de todas las aulas
   * de esa escuela en una sola transacción.
   *
   * @param escuelaId - UUID de la escuela.
   * @param profesorId - UUID del docente.
   * @throws Error si la base de datos no está disponible.
   */
    async removeDocenteRelation(escuelaId: string, profesorId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const prismaAny = prisma as any;
        const now = new Date();

        return await prismaAny.$transaction(async (tx: any) => {
            await tx.profesoresEscuelas.updateMany({
                where: {
                    profesor_id: profesorId,
                    escuela_id: escuelaId,
                    fecha_fin: null,
                },
                data: {
                    fecha_fin: now,
                },
            });

            await tx.profesoresAulas.updateMany({
                where: {
                    profesor_id: profesorId,
                    fecha_fin: null,
                    aula: { escuela_id: escuelaId },
                },
                data: {
                    fecha_fin: now,
                },
            });
        });
    },

  /**
   * Asigna un directivo a una escuela actualizando su `escuela_id` en `usuarioPerfil`.
   *
   * @param escuelaId - UUID de la escuela.
   * @param usuarioId - UUID del usuario directivo.
   * @returns El perfil de usuario actualizado.
   */
    async addDirectivoRelation(escuelaId: string, usuarioId: string) {
        const prisma = getPrisma();
        return await (prisma as any).usuarioPerfil.update({
            where: { id: usuarioId },
            data: { escuela_id: escuelaId }
        });
    },

  /**
   * Desasigna un directivo de su escuela poniendo `escuela_id = null`.
   *
   * @param usuarioId - UUID del usuario directivo.
   * @returns El perfil de usuario actualizado.
   */
    async removeDirectivoRelation(usuarioId: string) {
        const prisma = getPrisma();
        return await (prisma as any).usuarioPerfil.update({
            where: { id: usuarioId },
            data: { escuela_id: null }
        });
    },

  /**
   * Retorna las escuelas visibles para un usuario según su rol.
   *
   * @remarks
   * - `"director"`: retorna únicamente su propia escuela.
   * - `"encargado_zona"`: retorna las escuelas de su zona.
   * - Cualquier otro rol (admin): retorna todas las escuelas.
   *
   * @param user - Datos del usuario autenticado.
   * @returns Array de `{ id, nombre }` de las escuelas accesibles.
   * @throws Error si la base de datos no está disponible.
   */
    async getEscuelasParaRol(user: {
        id: string;
        rol: string;
        escuela_id: string | null;
    }): Promise<{ id: string; nombre: string }[]> {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        if (user.rol === "director") {
            if (!user.escuela_id) return [];
            const escuela = await prisma.escuelas.findUnique({
                where: { id: user.escuela_id },
                select: { id: true, nombre: true },
            });
            return escuela ? [escuela] : [];
        }

        if (user.rol === "encargado_zona") {
            const encargado = await prisma.encargados.findUnique({
                where: { usuario_id: user.id },
                select: { zona_id: true },
            });
            if (!encargado?.zona_id) return [];
            return prisma.escuelas.findMany({
                where: { zona_id: encargado.zona_id },
                select: { id: true, nombre: true },
                orderBy: { nombre: "asc" },
            });
        }

        // equipo_padi: todas
        return prisma.escuelas.findMany({
            select: { id: true, nombre: true },
            orderBy: { nombre: "asc" },
        });
    },

};