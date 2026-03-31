import { container } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.config';

container.registerSingleton(PrismaService);

const prismaService = container.resolve(PrismaService);
export const prismaClient: PrismaClient = prismaService.getClient();
