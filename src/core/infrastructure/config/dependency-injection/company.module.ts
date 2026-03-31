import { container } from 'tsyringe';
import { CompanyRepository } from '../../database/repositories/company.repository';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { GetCompanyUseCase } from '../../../application/use-cases/company/get-company.use-case';
import { UpsertCompanyUseCase } from '../../../application/use-cases/company/upsert-company.use-case';
import { prismaClient } from './prisma.module';

container.register<ICompanyRepository>('ICompanyRepository', {
  useFactory: () => new CompanyRepository(prismaClient),
});

container.register(GetCompanyUseCase, GetCompanyUseCase);
container.register(UpsertCompanyUseCase, UpsertCompanyUseCase);
