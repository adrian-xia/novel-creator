import { PrismaClient } from '@prisma/client';

export function createPrismaClient() {
  return new PrismaClient();
}

export const prisma = createPrismaClient();
