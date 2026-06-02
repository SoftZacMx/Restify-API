import { injectable } from 'tsyringe';
import { Prisma, BranchStatus as PrismaBranchStatus } from '@prisma/client';
import { Branch, BranchStatus } from '../../../domain/entities/branch.entity';

export interface CreateFirstBranchInput {
  organizationId: string;
  name: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  phone: string;
  rfc?: string | null;
  startOperations?: string | null;
  endOperations?: string | null;
  timezone: string;
  currency?: string;
}

/**
 * Use case for creating the first branch during signup.
 *
 * This is different from CreateBranchUseCase because it:
 * - Does NOT validate branch limits (first branch is always allowed)
 * - Works within a transaction (signup creates org + user + branch atomically)
 * - Does NOT use tenant context (signup runs with withoutTenant)
 * - Takes organizationId explicitly as input
 *
 * For regular branch creation (after signup), use CreateBranchUseCase instead.
 */
@injectable()
export class CreateFirstBranchUseCase {
  /**
   * Create the first branch for a new organization.
   *
   * @param tx - Prisma transaction (part of signup transaction, supports both base and extended clients)
   * @param input - Branch data
   * @returns Created branch entity
   */
  async execute(tx: any, input: CreateFirstBranchInput): Promise<Branch> {
    const branchData = await tx.branch.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        state: input.state,
        city: input.city,
        street: input.street,
        exteriorNumber: input.exteriorNumber,
        phone: input.phone,
        rfc: input.rfc ?? null,
        logoUrl: null,
        startOperations: input.startOperations ?? null,
        endOperations: input.endOperations ?? null,
        timezone: input.timezone,
        currency: input.currency ?? 'MXN',
        status: PrismaBranchStatus.ACTIVE,
        ticketConfig: Prisma.JsonNull,
        paymentConfig: null,
      },
    });

    // Map Prisma data to domain entity
    return new Branch(
      branchData.id,
      branchData.organizationId,
      branchData.name,
      branchData.state,
      branchData.city,
      branchData.street,
      branchData.exteriorNumber,
      branchData.phone,
      branchData.rfc,
      branchData.logoUrl,
      branchData.startOperations,
      branchData.endOperations,
      branchData.ticketConfig,
      branchData.paymentConfig,
      branchData.timezone,
      branchData.currency,
      this.toDomainStatus(branchData.status),
      branchData.createdAt,
      branchData.updatedAt,
      branchData.deletedAt
    );
  }

  private toDomainStatus(status: PrismaBranchStatus): BranchStatus {
    return status === PrismaBranchStatus.ACTIVE ? 'active' : 'disabled';
  }
}
