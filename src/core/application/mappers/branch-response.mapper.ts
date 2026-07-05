import { Branch } from '../../domain/entities/branch.entity';
import { BranchListItemRow } from '../../domain/interfaces/branch-repository.interface';

export interface BranchListItemResponse {
  id: string;
  name: string;
  city: string;
  state: string;
  status: 'active' | 'disabled';
  assignedUsersCount: number;
  lastOrderAt: string | null;
}

export interface BranchDetailResponse {
  id: string;
  organizationId: string;
  slug: string | null;
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
  timezone: string;
  currency: string;
  ticketConfig: unknown | null;
  paymentConfig: string | null;
  hasPaymentConfig: boolean;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export function toBranchListItem(row: BranchListItemRow): BranchListItemResponse {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    status: row.status,
    assignedUsersCount: row.assignedUsersCount,
    lastOrderAt: row.lastOrderAt ? row.lastOrderAt.toISOString() : null,
  };
}

export function toBranchDetail(branch: Branch): BranchDetailResponse {
  return {
    id: branch.id,
    organizationId: branch.organizationId,
    slug: branch.slug,
    name: branch.name,
    state: branch.state,
    city: branch.city,
    street: branch.street,
    exteriorNumber: branch.exteriorNumber,
    phone: branch.phone,
    rfc: branch.rfc,
    logoUrl: branch.logoUrl,
    startOperations: branch.startOperations,
    endOperations: branch.endOperations,
    timezone: branch.timezone,
    currency: branch.currency,
    ticketConfig: branch.ticketConfig,
    paymentConfig: branch.paymentConfig,
    hasPaymentConfig: Boolean(branch.paymentConfig?.trim()),
    status: branch.status,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  };
}
