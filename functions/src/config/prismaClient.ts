import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null | undefined;

export function getPrisma(): PrismaClient | null {
  if (prisma !== undefined) return prisma;
  if (!process.env.DATABASE_URL) {
    prisma = null;
    return prisma;
  }
  prisma = new PrismaClient();
  return prisma;
}


