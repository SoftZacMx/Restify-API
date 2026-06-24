import { Branch, BranchStatus } from '../entities/branch.entity';

export interface CreateBranchData {
  organizationId: string;
  name: string;
  slug?: string | null;
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
  timezone?: string;
  currency?: string;
  status?: BranchStatus;
}

export interface UpdateBranchData {
  name?: string;
  slug?: string | null;
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
  timezone?: string;
  currency?: string;
  status?: BranchStatus;
}

export interface ListBranchesOptions {
  includeDisabled?: boolean;
}

export interface BranchListItemRow {
  id: string;
  name: string;
  city: string;
  state: string;
  status: BranchStatus;
  assignedUsersCount: number;
  lastOrderAt: Date | null;
}

export interface IBranchRepository {
  findById(id: string): Promise<Branch | null>;
  findBySlug(slug: string): Promise<Branch | null>;
  findByIdAndOrganizationId(id: string, organizationId: string): Promise<Branch | null>;
  findAllIdsByOrganizationId(organizationId: string): Promise<string[]>;
  findManyByOrganizationId(organizationId: string, options?: ListBranchesOptions): Promise<Branch[]>;
  findManyForList(
    organizationId: string,
    branchIds: string[] | null,
    options?: ListBranchesOptions
  ): Promise<BranchListItemRow[]>;
  countActiveByOrganizationId(organizationId: string): Promise<number>;
  create(data: CreateBranchData): Promise<Branch>;
  update(id: string, data: UpdateBranchData): Promise<Branch>;
}
