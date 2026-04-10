import { Prisma, PrismaClient } from '@prisma/client';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import { Company } from '../../../domain/entities/company.entity';

export class CompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findFirst(): Promise<Company | null> {
    const company = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!company) return null;
    return this.toEntity(company);
  }

  async create(data: {
    name: string;
    state: string;
    city: string;
    street: string;
    exteriorNumber: string;
    phone: string;
    rfc?: string | null;
    logoUrl?: string | null;
    startOperations?: string | null;
    endOperations?: string | null;
    ticketConfig?: unknown | null;
    paymentConfig?: string | null;
  }): Promise<Company> {
    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        state: data.state,
        city: data.city,
        street: data.street,
        exteriorNumber: data.exteriorNumber,
        phone: data.phone,
        rfc: data.rfc ?? null,
        logoUrl: data.logoUrl ?? null,
        startOperations: data.startOperations ?? null,
        endOperations: data.endOperations ?? null,
        ...(data.ticketConfig !== undefined && {
          ticketConfig:
            data.ticketConfig === null
              ? Prisma.JsonNull
              : (data.ticketConfig as Prisma.InputJsonValue),
        }),
        ...(data.paymentConfig !== undefined && { paymentConfig: data.paymentConfig }),
      },
    });
    return this.toEntity(company);
  }

  async update(
    id: string,
    data: {
      name?: string;
      state?: string;
      city?: string;
      street?: string;
      exteriorNumber?: string;
      phone?: string;
      rfc?: string | null;
      logoUrl?: string | null;
      startOperations?: string | null;
      endOperations?: string | null;
      ticketConfig?: unknown | null;
      paymentConfig?: string | null;
    }
  ): Promise<Company> {
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.exteriorNumber !== undefined && { exteriorNumber: data.exteriorNumber }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.rfc !== undefined && { rfc: data.rfc }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.startOperations !== undefined && { startOperations: data.startOperations }),
        ...(data.endOperations !== undefined && { endOperations: data.endOperations }),
        ...(data.ticketConfig !== undefined && {
          ticketConfig:
            data.ticketConfig === null
              ? Prisma.JsonNull
              : (data.ticketConfig as Prisma.InputJsonValue),
        }),
        ...(data.paymentConfig !== undefined && { paymentConfig: data.paymentConfig }),
      },
    });
    return this.toEntity(company);
  }

  private toEntity(row: {
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
    ticketConfig: Prisma.JsonValue | null;
    paymentConfig: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Company {
    return new Company(
      row.id,
      row.name,
      row.state,
      row.city,
      row.street,
      row.exteriorNumber,
      row.phone,
      row.rfc,
      row.logoUrl,
      row.startOperations,
      row.endOperations,
      row.ticketConfig,
      row.paymentConfig,
      row.createdAt,
      row.updatedAt
    );
  }
}
