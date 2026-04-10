import { container } from 'tsyringe';
import { CompanyRepository } from '../../database/repositories/company.repository';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { GetCompanyUseCase } from '../../../application/use-cases/company/get-company.use-case';
import { UpsertCompanyUseCase } from '../../../application/use-cases/company/upsert-company.use-case';
import { PaymentConfigService } from '../../../application/services/payment-config.service';
import { GetPaymentConfigUseCase } from '../../../application/use-cases/settings/get-payment-config.use-case';
import { SavePaymentConfigUseCase } from '../../../application/use-cases/settings/save-payment-config.use-case';
import { prismaClient } from './prisma.module';

container.register<ICompanyRepository>('ICompanyRepository', {
  useFactory: () => new CompanyRepository(prismaClient),
});

container.register(GetCompanyUseCase, GetCompanyUseCase);
container.register(UpsertCompanyUseCase, UpsertCompanyUseCase);
container.registerSingleton(PaymentConfigService);
container.register(GetPaymentConfigUseCase, GetPaymentConfigUseCase);
container.register(SavePaymentConfigUseCase, SavePaymentConfigUseCase);
