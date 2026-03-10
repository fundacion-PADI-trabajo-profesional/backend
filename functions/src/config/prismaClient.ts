import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

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