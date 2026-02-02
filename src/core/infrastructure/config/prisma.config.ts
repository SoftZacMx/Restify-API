import { PrismaClient } from '@prisma/client';
import { singleton } from 'tsyringe';

@singleton()
export class PrismaService {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      log: ['error'],
    });
    
  }

  getClient(): PrismaClient {
    return this.client;
  }

  async connect(): Promise<void> {
    try {
      await this.client.$connect();
    } catch (error) {
      console.error('❌ [Prisma] Error al conectar a la base de datos:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ [Prisma] Health check falló:', error);
      return false;
    }
  }
}

