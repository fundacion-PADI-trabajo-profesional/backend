import { PrismaClient, Prisma } from "@prisma/client";
import { rlsContext } from "./rlsContext";

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

/**
 * Ejecuta `fn` dentro de una transacción de Prisma que configura el contexto
 * RLS de PostgreSQL (`request.jwt.claims` y `ROLE authenticated`) si hay
 * claims disponibles en el {@link rlsContext} del hilo actual.
 *
 * @param fn - Función que recibe un {@link Prisma.TransactionClient} y retorna una Promise.
 * @returns El valor retornado por `fn`.
 * @throws Error si la base de datos no está disponible.
 */
export async function withRLSContext<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not available");

  const claims = rlsContext.get();

  return prisma.$transaction(async (tx) => {
    if (claims) {
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    }
    return fn(tx);
  });
}

/**
 * Ejecuta `fn` dentro de una transacción de Prisma con rol `equipo_padi`.
 * Usado para operaciones administrativas que requieren permisos elevados.
 *
 * @remarks
 * Esta función bypasa el contexto RLS del usuario actual y fuerza el uso
 * de `equipo_padi` como rol administrativo. Úsala solo para operaciones
 * administrativas donde se necesitan permisos completos (crear docentes desde
 * director/encargado_zona, etc).
 *
 * @param fn - Función que recibe un {@link Prisma.TransactionClient} y retorna una Promise.
 * @returns El valor retornado por `fn`.
 * @throws Error si la base de datos no está disponible.
 */
export async function withRLSContextAsAdmin<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DB not available");

  // Corre como el usuario de la conexión (postgres/superuser), que bypasea RLS.
  // La autorización ya fue validada por requireRole en la capa de rutas.
  return prisma.$transaction(fn);
}