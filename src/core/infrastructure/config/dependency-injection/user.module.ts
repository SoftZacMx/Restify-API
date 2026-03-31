import { container } from 'tsyringe';
import { UserRepository } from '../../database/repositories/user.repository';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { prismaClient } from './prisma.module';

container.register<IUserRepository>('IUserRepository', {
  useFactory: () => new UserRepository(prismaClient),
});
