import { getPrisma } from "../config/prismaClient";
import { CreateEscuelaDto } from "../interfaces/escuela.interface";

export const EscuelasRepository = {
    // Busca el perfil de encargado usando el ID de usuario (login)
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
                    encargado_id: data.encargado_id
                }
            });
        } catch (error: any) {
            console.error("Error repository create escuela:", error);
            throw new Error("Error al crear la escuela en base de datos.");
        }
    },

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

            return await tx.escuelas.delete({
                where: { id }
            });
        });
    },

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

    async update(id: string, data: {
        nombre: string;
        direccion?: string;
        telefono?: string;
        zona_id: string
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
                    zona_id: data.zona_id
                }
            });
        } catch (error: any) {
            console.error("Error repository update escuela:", error);
            // Si el error es porque la zona_id no existe, Prisma lanzará una excepción de clave foránea
            throw new Error("Error al actualizar la escuela en base de datos.");
        }
    },

    // Lista TODAS las escuelas (Para Equipo PADI)
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

    // Lista solo escuelas de un encargado específico (Para Encargado Zona)
    async findByEncargadoId(encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB not available");

        const rows = await prisma.escuelas.findMany({
            where: { encargado_id: encargadoId },
            include: {
                directivos: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' }
        });

        return this.mapEscuelaDocentes(rows);
    },

    // Lista escuelas por zona (para encargados de esa zona)
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

    async addDirectivoRelation(escuelaId: string, usuarioId: string) {
        const prisma = getPrisma();
        return await (prisma as any).usuarioPerfil.update({
            where: { id: usuarioId },
            data: { escuela_id: escuelaId }
        });
    },

    async removeDirectivoRelation(usuarioId: string) {
        const prisma = getPrisma();
        return await (prisma as any).usuarioPerfil.update({
            where: { id: usuarioId },
            data: { escuela_id: null }
        });
    },

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