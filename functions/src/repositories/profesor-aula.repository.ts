import { withRLSContext } from "../config/prismaClient";

/**
 * Repositorio de acceso a datos para la relación docente-aula (`profesoresAulas`).
 */
export const ProfesoresAulasRepository = {
  /**
   * Asigna un docente a un aula creando un registro en `profesoresAulas`.
   */
  async add(profesorId: string, aulaId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).profesoresAulas.create({
        data: {
          profesor_id: profesorId,
          aula_id: aulaId,
        },
      });
    });
  },

  /**
   * Elimina la asignación de un docente a un aula.
   */
  async remove(profesorId: string, aulaId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).profesoresAulas.deleteMany({
        where: {
          profesor_id: profesorId,
          aula_id: aulaId,
        },
      });
    });
  },

  /**
   * Lista los docentes asignados a un aula específica.
   */
  async listByAula(aulaId: string) {
    return withRLSContext(async (tx) => {
      return (tx as any).profesoresAulas.findMany({
        where: { aula_id: aulaId },
        include: {
          profesor: {
            include: {
              personas: {
                select: {
                  nombre: true,
                  primer_apellido: true,
                },
              },
            },
          },
        },
      });
    });
  },
};
