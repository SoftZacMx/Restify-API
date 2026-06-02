import { OrganizationStatus, PrismaClient } from '@prisma/client';
import {
  IOrganizationRepository,
  OrganizationRecord,
} from '../../../domain/interfaces/organization-repository.interface';

export class OrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<OrganizationRecord | null> {
    const row = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toRecord(row) : null;
  }

  async findFirstActive(): Promise<OrganizationRecord | null> {
    const row = await this.prisma.organization.findFirst({
      where: { status: OrganizationStatus.ACTIVE, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: {
    id: string;
    name: string;
    plan: OrganizationRecord['plan'];
    status: OrganizationRecord['status'];
  }): OrganizationRecord {
    return {
      id: row.id,
      name: row.name,
      plan: row.plan,
      status: row.status,
    };
  }
}
