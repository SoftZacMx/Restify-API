import { BranchStatus as PrismaBranchStatus, Prisma, PrismaClient } from '@prisma/client';
import {
  BranchListItemRow,
  CreateBranchData,
  IBranchRepository,
  ListBranchesOptions,
  UpdateBranchData,
} from '../../../domain/interfaces/branch-repository.interface';
import { Branch, BranchStatus } from '../../../domain/entities/branch.entity';

export class BranchRepository implements IBranchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Branch | null> {
    const row = await this.prisma.branch.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByIdAndOrganizationId(id: string, organizationId: string): Promise<Branch | null> {
    const row = await this.prisma.branch.findFirst({
      where: { id, organizationId },
    });
    return row ? this.toEntity(row) : null;
  }

  async findAllIdsByOrganizationId(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.branch.findMany({
      where: { organizationId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => row.id);
  }

  async findManyForList(
    organizationId: string,
    branchIds: string[] | null,
    options?: ListBranchesOptions
  ): Promise<BranchListItemRow[]> {
    const where = {
      organizationId,
      ...(branchIds && branchIds.length > 0 ? { id: { in: branchIds } } : {}),
      ...(options?.includeDisabled ? {} : { status: PrismaBranchStatus.ACTIVE }),
    };

    const branches = await this.prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (branches.length === 0) {
      return [];
    }

    const ids = branches.map((b) => b.id);

    const [accessCounts, orderAgg] = await Promise.all([
      this.prisma.userBranchAccess.groupBy({
        by: ['branchId'],
        where: { branchId: { in: ids } },
        _count: { branchId: true },
      }),
      this.prisma.order.groupBy({
        by: ['branchId'],
        where: { branchId: { in: ids } },
        _max: { createdAt: true },
      }),
    ]);

    const countByBranchId = new Map(
      accessCounts.map((row) => [row.branchId, row._count.branchId])
    );
    const lastOrderByBranchId = new Map(
      orderAgg
        .filter((row) => row.branchId != null)
        .map((row) => [row.branchId as string, row._max.createdAt])
    );

    return branches.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      status: this.toDomainStatus(row.status),
      assignedUsersCount: countByBranchId.get(row.id) ?? 0,
      lastOrderAt: lastOrderByBranchId.get(row.id) ?? null,
    }));
  }

  async findManyByOrganizationId(
    organizationId: string,
    options?: ListBranchesOptions
  ): Promise<Branch[]> {
    const rows = await this.prisma.branch.findMany({
      where: {
        organizationId,
        ...(options?.includeDisabled ? {} : { status: PrismaBranchStatus.ACTIVE }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async countActiveByOrganizationId(organizationId: string): Promise<number> {
    return this.prisma.branch.count({
      where: { organizationId, status: PrismaBranchStatus.ACTIVE },
    });
  }

  async create(data: CreateBranchData): Promise<Branch> {
    const row = await this.prisma.branch.create({
      data: {
        organizationId: data.organizationId,
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
        timezone: data.timezone ?? 'America/Mexico_City',
        currency: data.currency ?? 'MXN',
        status: data.status ? this.toPrismaStatus(data.status) : PrismaBranchStatus.ACTIVE,
        ...(data.ticketConfig !== undefined && {
          ticketConfig:
            data.ticketConfig === null
              ? Prisma.JsonNull
              : (data.ticketConfig as Prisma.InputJsonValue),
        }),
        ...(data.paymentConfig !== undefined && { paymentConfig: data.paymentConfig }),
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: UpdateBranchData): Promise<Branch> {
    const row = await this.prisma.branch.update({
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
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.status !== undefined && { status: this.toPrismaStatus(data.status) }),
        ...(data.ticketConfig !== undefined && {
          ticketConfig:
            data.ticketConfig === null
              ? Prisma.JsonNull
              : (data.ticketConfig as Prisma.InputJsonValue),
        }),
        ...(data.paymentConfig !== undefined && { paymentConfig: data.paymentConfig }),
      },
    });
    return this.toEntity(row);
  }

  private toPrismaStatus(status: BranchStatus): PrismaBranchStatus {
    return status === 'active' ? PrismaBranchStatus.ACTIVE : PrismaBranchStatus.DISABLED;
  }

  private toDomainStatus(status: PrismaBranchStatus): BranchStatus {
    return status === PrismaBranchStatus.ACTIVE ? 'active' : 'disabled';
  }

  private toEntity(row: {
    id: string;
    organizationId: string;
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
    timezone: string;
    currency: string;
    status: PrismaBranchStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): Branch {
    return new Branch(
      row.id,
      row.organizationId,
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
      row.timezone,
      row.currency,
      this.toDomainStatus(row.status),
      row.createdAt,
      row.updatedAt,
      row.deletedAt
    );
  }
}
