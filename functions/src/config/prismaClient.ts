import { PrismaClient } from "@prisma/client";

/** Instancia singleton de {@link PrismaClient}. Se inicializa de forma diferida en la primera llamada a {@link getPrisma}. */
let prisma: PrismaClient | null = null;

/**
 * Retorna la instancia singleton de {@link PrismaClient}, inicializándola de forma diferida si aún no existe.
 *
 * @remarks
 * La inicialización diferida (lazy initialization) es intencional: Firebase Functions analiza
 * el módulo antes de ejecutarlo, y crear un `PrismaClient` en el nivel superior del módulo
 * provocaría un timeout durante ese análisis. Al diferir la creación al primer uso real,
 * se evita ese problema.
 *
 * Si la variable de entorno `DATABASE_URL` no está definida, la función registra un error
 * y retorna `null` sin lanzar una excepción, delegando el manejo del error al llamador.
 *
 * @returns La instancia de {@link PrismaClient} lista para usar, o `null` si `DATABASE_URL`
 * no está configurada en el entorno.
 *
 * @example
 * ```typescript
 * const prisma = getPrisma();
 * if (!prisma) throw new Error("Base de datos no disponible");
 * const estudiantes = await prisma.estudiante.findMany();
 * ```
 */
export function getPrisma(): PrismaClient | null {
  if (prisma) return prisma;

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL no está definida");
    return null;
  }

  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  return prisma;
}