import { getPrisma } from "../config/prismaClient";

// Repository (acceso a datos): punto para hablar con la BDD
// Verifica la conexion con la base de Prisma

export class HealthRepository {
  /**
   * Verifica la conexión a la base de datos ejecutando una consulta simple.
   * Si la consulta falla, Prisma lanzará un error que será capturado más arriba.
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