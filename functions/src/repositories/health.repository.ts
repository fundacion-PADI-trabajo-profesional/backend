import { getPrisma } from "../config/prismaClient";

/**
 * Repositorio de health-check de la base de datos.
 *
 * @remarks
 * Usado exclusivamente por los endpoints de liveness/readiness para
 * verificar que la conexión a Prisma (y por ende a la base de datos)
 * está operativa. No realiza ninguna operación de negocio.
 */
export class HealthRepository {
  /**
   * Verifica la conexión a la base de datos ejecutando `SELECT 1`.
   *
   * @returns `{ ok: true }` si la conexión es exitosa.
   * @throws Error si el cliente Prisma no está disponible o si la consulta falla.
   */
  async getStatus(): Promise<{ ok: true }> {
    const prisma = getPrisma();

    if (!prisma) {
      //lanza el error si DATABASE_URL no esta configurada.
      throw new Error("Prisma client no está disponible. Revisa las variables de entorno.");
    }

    // Ejecuta una consulta real. Si esto funciona, la DB esta viva.
    await prisma.$queryRaw`SELECT 1`;

    // Si la consulta no lanzo error, devolvemos el 'ok'.
    return { ok: true };
  }
}