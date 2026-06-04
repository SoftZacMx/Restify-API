import { OrganizationStatus, PrismaClient, UserRole } from '@prisma/client';
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

  async findByIdIncludingDeleted(id: string): Promise<OrganizationRecord | null> {
    const row = await this.prisma.organization.findFirst({
      where: { id },
    });
    return row ? this.toRecord(row) : null;
  }

  async close(id: string): Promise<OrganizationRecord> {
    // Atómico: cierre de la org + invalidación de todas las sesiones de sus usuarios.
    // Dentro de $transaction la tenant-extension NO se propaga, por eso filtramos
    // explícitamente por organizationId (no dependemos del contexto).
    const [, org] = await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { organizationId: id },
        data: { tokenVersion: { increment: 1 } },
      }),
      this.prisma.organization.update({
        where: { id },
        data: { deletedAt: new Date(), status: OrganizationStatus.CANCELLED },
      }),
    ]);
    return this.toRecord(org);
  }

  async reactivate(id: string): Promise<OrganizationRecord> {
    const org = await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: null, status: OrganizationStatus.ACTIVE },
    });
    return this.toRecord(org);
  }

  async findUnverifiedOwnerOrgIdsOlderThan(threshold: Date): Promise<string[]> {
    // Orgs aún abiertas cuyo OWNER nunca verificó email y son anteriores al umbral.
    // Filtramos por el owner (no cualquier user): es quien hace el signup público.
    const orgs = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        createdAt: { lt: threshold },
        users: {
          some: { rol: UserRole.OWNER, emailVerifiedAt: null },
        },
      },
      select: { id: true },
    });
    return orgs.map((o) => o.id);
  }

  private toRecord(row: {
    id: string;
    name: string;
    plan: OrganizationRecord['plan'];
    status: OrganizationRecord['status'];
    deletedAt: Date | null;
  }): OrganizationRecord {
    return {
      id: row.id,
      name: row.name,
      plan: row.plan,
      status: row.status,
      deletedAt: row.deletedAt,
    };
  }
}
