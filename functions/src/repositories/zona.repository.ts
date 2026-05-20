import { getPrisma } from "../config/prismaClient";

/**
 * Repositorio de acceso a datos para zonas geográficas.
 *
 * @remarks
 * Las zonas agrupan escuelas bajo la supervisión de un encargado de zona.
 * Los encargados y escuelas se asignan/desasignan individualmente mediante
 * sus propios métodos. La tabla `zonas` se relaciona con `escuelas` (1-a-N)
 * y con `encargados` (1-a-N, aunque en la práctica suele ser 1-a-1).
 */
export const ZonasRepository = {
  /**
   * Crea una zona nueva con el nombre indicado.
   *
   * @param nombre - Nombre identificatorio de la zona (p. ej. `"Zona Norte"`).
   * @returns El registro de zona creado.
   * @throws Error si la base de datos no está disponible.
   */
    async create(nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.create({
            data: { nombre }
        });
    },

  /**
   * Lista todas las zonas con sus encargados y conteo de escuelas y encargados.
   *
   * @returns Array de zonas ordenadas por nombre, cada una con `encargados` (usuario incluido)
   *          y `_count` con el número de escuelas y encargados.
   * @throws Error si la base de datos no está disponible.
   */
    async listAll() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findMany({
            include: {
                encargados: {
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                nombre: true,
                                apellido: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { escuelas: true, encargados: true }
                }
            },
            orderBy: { nombre: "asc" }
        });
    },

  /**
   * Busca una zona por su UUID, incluyendo escuelas y encargados.
   *
   * @param id - UUID de la zona.
   * @returns El registro de zona con relaciones, o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
    async findById(id: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findUnique({
            where: { id },
            include: {
                escuelas: true,
                encargados: {
                    include: { usuario: true } // Para traer nombre/apellido del encargado
                }
            }
        });
    },

  /**
   * Busca una zona por su nombre exacto.
   *
   * @param nombre - Nombre exacto de la zona.
   * @returns El registro de zona o `null` si no existe.
   * @throws Error si la base de datos no está disponible.
   */
    async findByName(nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");

        // Usamos prismaAny para mantener consistencia con tu estilo de código
        const prismaAny = prisma as any;

        return await prismaAny.zonas.findUnique({
            where: { nombre }
        });
    },

  /**
   * Asigna una escuela a una zona actualizando su `zona_id`.
   *
   * @param zonaId - UUID de la zona destino.
   * @param escuelaId - UUID de la escuela a asignar.
   * @returns El registro de escuela actualizado.
   * @throws Error si la base de datos no está disponible.
   */
    async assignEscuela(zonaId: string, escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.update({
            where: { id: escuelaId },
            data: { zona_id: zonaId }
        });
    },

  /**
   * Desasigna una escuela de su zona poniendo `zona_id = null`.
   *
   * @param escuelaId - UUID de la escuela a desasignar.
   * @returns El registro de escuela actualizado.
   * @throws Error si la base de datos no está disponible.
   */
    async unassignEscuela(escuelaId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.update({
            where: { id: escuelaId },
            data: {
                zona_id: null // Volvemos a dejar la escuela "huérfana"
            }
        });
    },

  /**
   * Lista las escuelas que aún no tienen zona asignada.
   *
   * @returns Array de escuelas con `zona_id = null`, ordenadas por nombre.
   * @throws Error si la base de datos no está disponible.
   */
    async listEscuelasSinZona() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.escuelas.findMany({
            where: {
                zona_id: null // Solo las que no tienen zona
            },
            orderBy: { nombre: "asc" }
        });
    },

  /**
   * Actualiza el nombre de una zona.
   *
   * @param id - UUID de la zona a actualizar.
   * @param nombre - Nuevo nombre de la zona.
   * @returns El registro de zona actualizado.
   * @throws Error si la base de datos no está disponible.
   */
    async update(id: string, nombre: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.zonas.update({
            where: { id },
            data: { nombre }
        });
    },

  /**
   * Lista los encargados de zona que aún no tienen zona asignada.
   *
   * @remarks
   * Usado en el formulario de asignación de encargados a zonas nuevas o vacantes.
   *
   * @returns Array de encargados con `zona_id = null` e información de usuario incluida.
   * @throws Error si la base de datos no está disponible.
   */
    async listEncargadosDisponibles() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.findMany({
            where: {
                zona_id: null // Solo los que no tienen zona asignada
            },
            include: {
                usuario: true // Para mostrar nombre y apellido
            }
        });
    },

  /**
   * Lista todos los encargados de zona con su zona asignada (o sin zona).
   *
   * @returns Array de encargados ordenados por apellido y nombre, con datos
   *          de usuario y zona incluidos.
   * @throws Error si la base de datos no está disponible.
   */
    async listEncargados() {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.findMany({
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        email: true,
                    },
                },
                zona: {
                    select: {
                        id: true,
                        nombre: true,
                    },
                },
            },
            orderBy: [
                { usuario: { apellido: "asc" } },
                { usuario: { nombre: "asc" } },
            ],
        });
    },

  /**
   * Asigna un encargado a una zona actualizando su `zona_id`.
   *
   * @param zonaId - UUID de la zona.
   * @param encargadoId - ID del encargado (PK de la tabla `encargados`).
   * @returns El registro de encargado actualizado.
   * @throws Error si la base de datos no está disponible.
   */
    async assignEncargado(zonaId: string, encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.update({
            where: { id: encargadoId },
            data: { zona_id: zonaId }
        });
    },

  /**
   * Desasigna un encargado de su zona poniendo `zona_id = null`.
   *
   * @param encargadoId - ID del encargado (PK de la tabla `encargados`).
   * @returns El registro de encargado actualizado.
   * @throws Error si la base de datos no está disponible.
   */
    async unassignEncargado(encargadoId: string) {
        const prisma = getPrisma();
        if (!prisma) throw new Error("DB no disponible");
        const prismaAny = prisma as any;

        return await prismaAny.encargados.update({
            where: { id: encargadoId },
            data: {
                zona_id: null
            }
        });
    }
};