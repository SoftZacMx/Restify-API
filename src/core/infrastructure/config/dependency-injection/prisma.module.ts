import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.config';
import { getPrisma } from '../../database/prisma/get-prisma';

container.registerSingleton(PrismaService);

/**
 * Prisma client con tenant extension (filtra automáticamente por org/branch).
 * Todos los repositorios reciben este client.
 * Cast seguro: en runtime el client extendido tiene todos los métodos de PrismaClient.
 */
export const prismaClient = getPrisma() as unknown as PrismaClient;

// Token 'PrismaClient' para use-cases que inyectan el cliente directamente (ej. SignupUseCase).
container.registerInstance<PrismaClient>('PrismaClient', prismaClient);
