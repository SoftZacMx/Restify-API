import { inject, injectable } from 'tsyringe';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { AppError } from '../../../../shared/errors';
import {
  mergeTicketPrintConfig,
  type ResolvedTicketPrintConfig,
} from '../../dto/ticket-print-config';

export interface GetCompanyResult {
  id: string;
  name: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  phone: string;
  rfc: string | null;
  logoUrl: string | null;
  startOperations: string | null;
  endOperations: string | null;
  ticketConfig: ResolvedTicketPrintConfig;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetCompanyUseCase {
  constructor(
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository
  ) {}

  async execute(): Promise<GetCompanyResult> {
    const company = await this.companyRepository.findFirst();

    if (!company) {
      throw new AppError('COMPANY_NOT_FOUND', 'No hay información de empresa configurada');
    }

    return {
      id: company.id,
      name: company.name,
      state: company.state,
      city: company.city,
      street: company.street,
      exteriorNumber: company.exteriorNumber,
      phone: company.phone,
      rfc: company.rfc,
      logoUrl: company.logoUrl,
      startOperations: company.startOperations,
      endOperations: company.endOperations,
      ticketConfig: mergeTicketPrintConfig(company.ticketConfig),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
