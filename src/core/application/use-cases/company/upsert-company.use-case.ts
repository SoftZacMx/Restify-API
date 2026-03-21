import { inject, injectable } from 'tsyringe';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { UpsertCompanyInput } from '../../dto/company.dto';
import {
  mergeTicketPrintConfig,
  type ResolvedTicketPrintConfig,
} from '../../dto/ticket-print-config';

export interface UpsertCompanyResult {
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
export class UpsertCompanyUseCase {
  constructor(
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository
  ) {}

  async execute(input: UpsertCompanyInput): Promise<UpsertCompanyResult> {
    const existing = await this.companyRepository.findFirst();

    if (existing) {
      const company = await this.companyRepository.update(existing.id, {
        name: input.name,
        state: input.state,
        city: input.city,
        street: input.street,
        exteriorNumber: input.exteriorNumber,
        phone: input.phone,
        rfc: input.rfc ?? null,
        logoUrl: input.logoUrl ?? null,
        startOperations: input.startOperations ?? null,
        endOperations: input.endOperations ?? null,
        ...(input.ticketConfig !== undefined && { ticketConfig: input.ticketConfig }),
      });
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

    const company = await this.companyRepository.create({
      name: input.name,
      state: input.state,
      city: input.city,
      street: input.street,
      exteriorNumber: input.exteriorNumber,
      phone: input.phone,
      rfc: input.rfc ?? null,
      logoUrl: input.logoUrl ?? null,
      startOperations: input.startOperations ?? null,
      endOperations: input.endOperations ?? null,
      ...(input.ticketConfig !== undefined && { ticketConfig: input.ticketConfig }),
    });

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
