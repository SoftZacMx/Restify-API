import { container } from 'tsyringe';
import { ReportFactory } from '../../../application/reports/report-factory';
import { GetDashboardUseCase } from '../../../application/use-cases/dashboard/get-dashboard.use-case';
import { GetReportsSummaryUseCase } from '../../../application/use-cases/reports/get-reports-summary.use-case';
import { IReportsSummaryRepository } from '../../../domain/interfaces/reports-summary-repository.interface';
import { ReportsSummaryRepository } from '../../database/repositories/reports-summary.repository';
import { prismaClient } from './prisma.module';

container.registerSingleton('ReportFactory', ReportFactory);

container.register<IReportsSummaryRepository>('IReportsSummaryRepository', {
  useFactory: () => new ReportsSummaryRepository(prismaClient),
});

container.register(GetDashboardUseCase, GetDashboardUseCase);
container.register(GetReportsSummaryUseCase, GetReportsSummaryUseCase);
