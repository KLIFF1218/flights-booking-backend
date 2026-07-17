import type { Prisma } from '@prisma/client';
import type { PrismaService } from 'src/infra/db/prisma/prisma.service';

export type PrismaClient = Prisma.TransactionClient | PrismaService;
