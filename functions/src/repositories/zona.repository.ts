import { withRLSContext } from "../config/prismaClient";

/**
 * Repositorio de acceso a datos para zonas geográficas.
 */
export const ZonasRepository = {
  /**
   * Crea una zona nueva con el nombre indicado.
   */
  async create(nombre: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).zonas.create({
        data: { nombre },
      });
    });
  },

  /**
   * Lista todas las zonas con sus encargados y conteo de escuelas y encargados.
   */
  async listAll() {
    return withRLSContext(async (tx) => {
      return (tx as any).zonas.findMany({
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
            select: { escuelas: true, encargados: true },
          },
        },
        orderBy: { nombre: "asc" },
      });
    });
  },

  /**
   * Busca una zona por su UUID, incluyendo escuelas y encargados.
   */
  async findById(id: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).zonas.findUnique({
        where: { id },
        include: {
          escuelas: true,
          encargados: {
            include: { usuario: true },
          },
        },
      });
    });
  },

  /**
   * Busca una zona por su nombre exacto.
   */
  async findByName(nombre: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).zonas.findUnique({
        where: { nombre },
      });
    });
  },

  /**
   * Asigna una escuela a una zona actualizando su `zona_id`.
   */
  async assignEscuela(zonaId: string, escuelaId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).escuelas.update({
        where: { id: escuelaId },
        data: { zona_id: zonaId },
      });
    });
  },

  /**
   * Desasigna una escuela de su zona poniendo `zona_id = null`.
   */
  async unassignEscuela(escuelaId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).escuelas.update({
        where: { id: escuelaId },
        data: { zona_id: null },
      });
    });
  },

  /**
   * Lista las escuelas que aún no tienen zona asignada.
   */
  async listEscuelasSinZona() {
    return withRLSContext(async (tx) => {
      return (tx as any).escuelas.findMany({
        where: { zona_id: null },
        orderBy: { nombre: "asc" },
      });
    });
  },

  /**
   * Actualiza el nombre de una zona.
   */
  async update(id: string, nombre: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).zonas.update({
        where: { id },
        data: { nombre },
      });
    });
  },

  /**
   * Lista los encargados de zona que aún no tienen zona asignada.
   */
  async listEncargadosDisponibles() {
    return withRLSContext(async (tx) => {
      return (tx as any).encargados.findMany({
        where: { zona_id: null },
        include: { usuario: true },
      });
    });
  },

  /**
   * Lista todos los encargados de zona con su zona asignada (o sin zona).
   */
  async listEncargados() {
    return withRLSContext(async (tx) => {
      return (tx as any).encargados.findMany({
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
    });
  },

  /**
   * Asigna un encargado a una zona actualizando su `zona_id`.
   */
  async assignEncargado(zonaId: string, encargadoId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).encargados.update({
        where: { id: encargadoId },
        data: { zona_id: zonaId },
      });
    });
  },

  /**
   * Desasigna un encargado de su zona poniendo `zona_id = null`.
   */
  async unassignEncargado(encargadoId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).encargados.update({
        where: { id: encargadoId },
        data: { zona_id: null },
      });
    });
  },
};
